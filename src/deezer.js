// Deezer API integration
class DeezerAPI {
  constructor() {
    this.baseUrl = 'https://api.deezer.com'
  }

  // JSONPリクエストを送信（Deezer APIはJSONPをサポート）
  jsonpRequest(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // URLの検証 - Deezer APIのみ許可
      try {
        const parsedUrl = new URL(url)
        if (!parsedUrl.hostname.endsWith('deezer.com')) {
          reject(new Error('Deezer API: 許可されていないURL'))
          return
        }
      } catch (e) {
        reject(new Error('Deezer API: 無効なURL'))
        return
      }
      
      const callbackName = `deezer_callback_${Date.now()}`
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
        reject(new Error('Deezer API: スクリプト読み込みエラー'))
      }
      
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('Deezer API: タイムアウト'))
      }, timeout)
      
      // DeezerはJSONPパラメータとして'output=jsonp'と'callback'を使用
      const separator = url.includes('?') ? '&' : '?'
      script.src = `${url}${separator}output=jsonp&callback=${callbackName}`
      document.head.appendChild(script)
    })
  }

  // トラックを検索
  async searchTracks(artist, song) {
    try {
      const query = encodeURIComponent(`artist:"${artist}" track:"${song}"`)
      const url = `${this.baseUrl}/search?q=${query}&limit=20`
      
      let data
      
      if (this.isProduction()) {
        // 本番環境：プロキシを使用
        try {
          data = await this.fetchViaProxy(url)
        } catch (proxyError) {
          console.warn('Deezerプロキシエラー、JSONPにフォールバック:', proxyError)
          data = await this.jsonpRequest(url)
        }
      } else {
        // 開発環境：直接JSONP
        data = await this.jsonpRequest(url)
      }
      
      if (data.data && Array.isArray(data.data)) {
        return data.data
      }
      
      return []
    } catch (error) {
      // フォールバック: アーティストと曲名を分けて検索
      try {
        const query = encodeURIComponent(`${artist} ${song}`)
        const url = `${this.baseUrl}/search?q=${query}&limit=20`
        
        let data
        
        if (this.isProduction()) {
          try {
            data = await this.fetchViaProxy(url)
          } catch (proxyError) {
            console.warn('Deezerプロキシエラー（フォールバック）:', proxyError)
            data = await this.jsonpRequest(url)
          }
        } else {
          data = await this.jsonpRequest(url)
        }
        
        if (data.data && Array.isArray(data.data)) {
          return data.data
        }
      } catch (fallbackError) {
        console.error('Deezer検索エラー:', fallbackError)
      }
      
      return []
    }
  }

  // 本番環境でプロキシを使用するための検出
  isProduction() {
    return window.location.hostname !== 'localhost' && 
           window.location.hostname !== '127.0.0.1'
  }

  // プロキシ経由でAPIリクエスト
  async fetchViaProxy(url) {
    const proxyUrl = `/api/proxy?service=deezer&url=${encodeURIComponent(url)}`
    const response = await fetch(proxyUrl)
    if (!response.ok) {
      throw new Error(`Proxy error: ${response.statusText}`)
    }
    return await response.json()
  }

  // アーティストと曲名で検索してアートワークを取得
  async search(artist, song) {
    const results = []
    
    try {
      const tracks = await this.searchTracks(artist, song)
      
      if (!tracks || tracks.length === 0) {
        return []
      }
      
      // 重複を避けるためのマップ
      const uniqueAlbums = new Map()
      
      tracks.forEach(track => {
        if (track.album && track.album.cover_xl) {
          const albumKey = track.album.id
          
          if (!uniqueAlbums.has(albumKey)) {
            // Deezerは複数サイズのカバーを提供
            // cover_small: 56x56
            // cover_medium: 250x250
            // cover_big: 500x500
            // cover_xl: 1000x1000
            const thumbnailUrl = track.album.cover_medium || track.album.cover_small
            const downloadUrl = track.album.cover_xl || track.album.cover_big || track.album.cover_medium
            
            uniqueAlbums.set(albumKey, {
              title: track.title || 'Unknown',
              artist: track.artist ? track.artist.name : 'Unknown Artist',
              album: track.album.title || '',
              imageUrl: thumbnailUrl, // サムネイル用は250x250
              downloadUrl: downloadUrl, // ダウンロード用は高解像度
              source: 'Deezer',
              resolution: '250x250',
              preview: track.preview // 30秒のプレビューURL
            })
          }
        }
      })
      
      results.push(...uniqueAlbums.values())
      
    } catch (error) {
      console.error('Deezer検索エラー:', error)
    }
    
    return results.slice(0, 12) // 最大12件まで
  }

  // アルバムの詳細情報を取得（オプション）
  async getAlbumInfo(albumId) {
    try {
      const url = `${this.baseUrl}/album/${albumId}`
      const data = await this.jsonpRequest(url)
      
      return data || null
    } catch (error) {
      console.error('Deezerアルバム情報取得エラー:', error)
      return null
    }
  }
}

export default DeezerAPI