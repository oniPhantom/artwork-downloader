// Last.fm API integration
class LastFmAPI {
  constructor() {
    // APIキーはLocalStorageから取得するか、環境変数から取得
    this.apiKey = null
    this.baseUrl = 'https://ws.audioscrobbler.com/2.0/'
  }

  // JSONPリクエストを送信
  jsonpRequest(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // URLの検証 - Last.fm APIのみ許可
      try {
        const parsedUrl = new URL(url)
        if (!parsedUrl.hostname.endsWith('last.fm')) {
          reject(new Error('Last.fm API: 許可されていないURL'))
          return
        }
      } catch (e) {
        reject(new Error('Last.fm API: 無効なURL'))
        return
      }
      
      const callbackName = `lastfm_callback_${Date.now()}`
      const script = document.createElement('script')
      
      window[callbackName] = (data) => {
        cleanup()
        resolve(data)
      }
      
      const cleanup = () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
        if (window[callbackName]) {
          delete window[callbackName]
        }
        clearTimeout(timeoutId)
      }
      
      script.onerror = () => {
        cleanup()
        reject(new Error('Last.fm API: スクリプト読み込みエラー'))
      }
      
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('Last.fm API: タイムアウト'))
      }, timeout)
      
      script.src = `${url}&callback=${callbackName}`
      document.head.appendChild(script)
    })
  }

  // トラック情報を検索
  async searchTrack(artist, song) {
    if (!this.apiKey) {
      console.warn('Last.fm APIキーが設定されていません')
      return []
    }
    
    try {
      const params = new URLSearchParams({
        method: 'track.search',
        track: song,
        artist: artist,
        api_key: this.apiKey,
        format: 'json',
        limit: 20
      })
      
      const url = `${this.baseUrl}?${params.toString()}`
      const data = await this.jsonpRequest(url)
      
      if (data.results && data.results.trackmatches && data.results.trackmatches.track) {
        return data.results.trackmatches.track
      }
      
      return []
    } catch (error) {
      console.error('Last.fm検索エラー:', error)
      throw error
    }
  }

  // トラックの詳細情報を取得（アルバムアートを含む）
  async getTrackInfo(artist, track) {
    if (!this.apiKey) {
      return null
    }
    
    try {
      const params = new URLSearchParams({
        method: 'track.getInfo',
        artist: artist,
        track: track,
        api_key: this.apiKey,
        format: 'json'
      })
      
      const url = `${this.baseUrl}?${params.toString()}`
      const data = await this.jsonpRequest(url)
      
      return data.track || null
    } catch (error) {
      console.error('Last.fmトラック情報取得エラー:', error)
      return null
    }
  }

  // アルバム情報を取得（高解像度アートワーク）
  async getAlbumInfo(artist, album) {
    if (!this.apiKey) {
      return null
    }
    
    try {
      const params = new URLSearchParams({
        method: 'album.getInfo',
        artist: artist,
        album: album,
        api_key: this.apiKey,
        format: 'json'
      })
      
      const url = `${this.baseUrl}?${params.toString()}`
      const data = await this.jsonpRequest(url)
      
      return data.album || null
    } catch (error) {
      console.error('Last.fmアルバム情報取得エラー:', error)
      return null
    }
  }

  // アーティストと曲名で検索してアートワークを取得
  async search(artist, song) {
    if (!this.apiKey) {
      console.warn('Last.fm APIキーが設定されていません')
      return []
    }
    
    const results = []
    
    try {
      // まずトラックを検索
      const tracks = await this.searchTrack(artist, song)
      
      if (!tracks || tracks.length === 0) {
        return []
      }
      
      // 各トラックの詳細情報を取得（並列処理）
      const trackInfoPromises = tracks.slice(0, 10).map(track => 
        this.getTrackInfo(track.artist, track.name)
      )
      
      const trackInfos = await Promise.allSettled(trackInfoPromises)
      
      // アルバム情報を収集
      const albumRequests = new Map()
      
      trackInfos.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const trackInfo = result.value
          if (trackInfo.album && trackInfo.album.title) {
            const key = `${trackInfo.artist.name}|${trackInfo.album.title}`
            if (!albumRequests.has(key)) {
              albumRequests.set(key, {
                artist: trackInfo.artist.name,
                album: trackInfo.album.title,
                track: trackInfo.name
              })
            }
          }
        }
      })
      
      // アルバム情報を取得（アートワーク含む）
      const albumPromises = Array.from(albumRequests.values()).map(req =>
        this.getAlbumInfo(req.artist, req.album)
      )
      
      const albumInfos = await Promise.allSettled(albumPromises)
      
      // 結果をフォーマット
      albumInfos.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const album = result.value
          const req = Array.from(albumRequests.values())[index]
          
          if (album.image && Array.isArray(album.image)) {
            // Last.fmは複数サイズの画像を提供（small, medium, large, extralarge, mega）
            const images = {}
            album.image.forEach(img => {
              if (img.size && img['#text']) {
                images[img.size] = img['#text']
              }
            })
            
            // 最大解像度の画像を選択
            const imageUrl = images.mega || images.extralarge || images.large || images.medium
            
            if (imageUrl && imageUrl !== '') {
              results.push({
                title: req.track || album.name || 'Unknown',
                artist: album.artist || 'Unknown Artist',
                album: album.name || '',
                imageUrl: imageUrl,
                source: 'Last.fm',
                resolution: images.mega ? '300x300+' : '300x300'
              })
            }
          }
        }
      })
      
    } catch (error) {
      console.error('Last.fm検索エラー:', error)
    }
    
    return results
  }
}

export default LastFmAPI