import './style.css'

class ArtworkDownloader {
  constructor() {
    this.initEventListeners()
    this.pendingRequests = new Map() // JSONP リクエスト管理
    this.callbackCounter = 0 // 一意なコールバック名生成
  }

  initEventListeners() {
    const searchForm = document.getElementById('search-form')
    searchForm.addEventListener('submit', this.handleSearch.bind(this))
  }

  async handleSearch(event) {
    event.preventDefault()
    
    const artist = document.getElementById('artist').value.trim()
    const song = document.getElementById('song').value.trim()
    
    // console.log('[DEBUG] 検索開始:', { artist, song })
    
    if (!artist || !song) {
      this.showError('アーティスト名と曲名の両方を入力してください')
      return
    }

    this.showLoading()
    this.hideError()
    this.hideResults()

    try {
      const artworks = await this.searchArtworks(artist, song)
      
      if (artworks.length === 0) {
        this.showError('アートワークが見つかりませんでした。別のキーワードで試してください。')
        return
      }

      this.displayResults(artworks)
    } catch (error) {
      this.showError(`検索エラー: ${error.message || 'しばらく後に再試行してください'}`)
    } finally {
      this.hideLoading()
    }
  }

  async searchArtworks(artist, song) {
    const artworks = []

    try {
      const itunesResults = await this.searchiTunes(artist, song)
      artworks.push(...itunesResults)
    } catch (error) {
      console.warn('iTunes検索エラー:', error)
    }

    return artworks
  }

  // JSONP でiTunes APIを呼び出し
  jsonpRequest(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const callbackName = `iTunes_callback_${++this.callbackCounter}`
      const script = document.createElement('script')
      
      // グローバルコールバック関数を設定
      window[callbackName] = (data) => {
        this.cleanupJsonpRequest(script, callbackName)
        resolve(data)
      }
      
      // エラーハンドリング
      script.onerror = () => {
        this.cleanupJsonpRequest(script, callbackName)
        reject(new Error('スクリプト読み込みエラー'))
      }
      
      // タイムアウト設定
      const timeoutId = setTimeout(() => {
        this.cleanupJsonpRequest(script, callbackName)
        reject(new Error('タイムアウト'))
      }, timeout)
      
      // リクエスト情報を保存
      this.pendingRequests.set(callbackName, { script, timeoutId })
      
      // スクリプトを挿入してリクエスト実行
      script.src = `${url}&callback=${callbackName}`
      document.head.appendChild(script)
    })
  }
  
  // JSONP リクエストのクリーンアップ
  cleanupJsonpRequest(script, callbackName) {
    if (this.pendingRequests.has(callbackName)) {
      const { timeoutId } = this.pendingRequests.get(callbackName)
      clearTimeout(timeoutId)
      this.pendingRequests.delete(callbackName)
    }
    
    if (script && script.parentNode) {
      script.parentNode.removeChild(script)
    }
    
    if (window[callbackName]) {
      delete window[callbackName]
    }
  }

  async searchiTunes(artist, song) {
    const searchTerms = [
      `${artist} ${song}`,
      artist
    ]

    const results = []

    for (const term of searchTerms) {
      try {
        const encodedTerm = encodeURIComponent(term)
        const url = `https://itunes.apple.com/search?term=${encodedTerm}&media=music&entity=album,song&limit=20`
        
        const data = await this.jsonpRequest(url)
        
        if (data.results && data.results.length > 0) {
          const uniqueArtworks = new Map()
          
          data.results.forEach(item => {
            if (item.artworkUrl100) {
              const artworkUrl600 = item.artworkUrl100.replace('100x100bb', '600x600bb')
              const artworkUrlLarge = item.artworkUrl100.replace('100x100bb', '1200x1200bb')
              
              const key = artworkUrl600
              
              if (!uniqueArtworks.has(key)) {
                uniqueArtworks.set(key, {
                  title: item.trackName || item.collectionName || 'Unknown',
                  artist: item.artistName || 'Unknown Artist',
                  album: item.collectionName || '',
                  imageUrl: artworkUrlLarge,
                  source: 'iTunes',
                  resolution: '1200x1200'
                })
              }
            }
          })
          
          results.push(...uniqueArtworks.values())
        }
      } catch (error) {
        console.warn(`[WARN] iTunes検索エラー (term: ${term}):`, error.message)
      }
    }

    // 最終結果数: ${results.length}
    return results.slice(0, 12)
  }

  displayResults(artworks) {
    const grid = document.getElementById('artwork-grid')
    grid.innerHTML = ''

    artworks.forEach((artwork, index) => {
      const card = this.createArtworkCard(artwork, index)
      grid.appendChild(card)
    })

    this.showResults()
  }

  createArtworkCard(artwork, index) {
    const card = document.createElement('div')
    card.className = 'artwork-card'

    card.innerHTML = `
      <img 
        src="${artwork.imageUrl}" 
        alt="${artwork.title} - ${artwork.artist}"
        class="artwork-image"
        loading="lazy"
        onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='"
      >
      <div class="artwork-info">
        <h3>${artwork.title}</h3>
        <p>アーティスト: ${artwork.artist}</p>
        ${artwork.album ? `<p>アルバム: ${artwork.album}</p>` : ''}
        <p>解像度: ${artwork.resolution}</p>
        <span class="source-badge">${artwork.source}</span>
      </div>
      <button class="download-btn" onclick="artworkDownloader.downloadArtwork('${artwork.imageUrl}', '${artwork.artist}', '${artwork.title}', ${index})">
        📥 ダウンロード (JPG)
      </button>
    `

    const img = card.querySelector('.artwork-image')
    img.addEventListener('click', () => {
      this.showImageModal(artwork)
    })

    return card
  }

  async downloadArtwork(imageUrl, artist, title, index) {
    const button = document.querySelectorAll('.download-btn')[index]
    const originalText = button.innerHTML
    
    try {
      // ダウンロード開始: ${imageUrl}
      button.innerHTML = '📥 ダウンロード中...'
      button.disabled = true

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      // デバイス: iOS=${isIOS}, Mobile=${isMobile}

      if (isMobile) {
        window.open(imageUrl, '_blank')
        button.innerHTML = '✅ 新しいタブで開きました'
        setTimeout(() => {
          button.innerHTML = originalText
          button.disabled = false
        }, 2000)
        return
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Accept': 'image/*',
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`画像取得失敗: ${response.status}`)
      }

      const blob = await response.blob()
      
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        canvas.toBlob((jpgBlob) => {
          try {
            const url = URL.createObjectURL(jpgBlob)
            const a = document.createElement('a')
            
            const filename = `${artist} - ${title}`.replace(/[<>:"/\\|?*]/g, '_')
            a.href = url
            a.download = `${filename}.jpg`
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            
            button.innerHTML = '✅ ダウンロード完了'
            setTimeout(() => {
              button.innerHTML = originalText
              button.disabled = false
            }, 2000)
          } catch (downloadError) {
            throw downloadError
          }
        }, 'image/jpeg', 0.9)
      }

      img.onerror = () => {
        throw new Error('画像の読み込みに失敗しました')
      }

      img.crossOrigin = 'anonymous'
      img.src = URL.createObjectURL(blob)

    } catch (error) {
      if (error.name === 'AbortError') {
        button.innerHTML = '❌ タイムアウト'
      } else {
        button.innerHTML = '❌ エラー'
      }
      setTimeout(() => {
        button.innerHTML = originalText
        button.disabled = false
      }, 2000)
    }
  }

  showImageModal(artwork) {
    const modal = document.createElement('div')
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      cursor: pointer;
    `

    const img = document.createElement('img')
    img.src = artwork.imageUrl
    img.style.cssText = `
      max-width: 90%;
      max-height: 90%;
      border-radius: 8px;
    `

    modal.appendChild(img)
    modal.addEventListener('click', () => document.body.removeChild(modal))
    document.body.appendChild(modal)
  }

  showLoading() {
    document.getElementById('loading').style.display = 'block'
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none'
  }

  showError(message) {
    const errorDiv = document.getElementById('error')
    const errorMessage = document.getElementById('error-message')
    errorMessage.textContent = message
    errorDiv.style.display = 'block'
  }

  hideError() {
    document.getElementById('error').style.display = 'none'
  }

  showResults() {
    document.getElementById('results').style.display = 'block'
  }

  hideResults() {
    document.getElementById('results').style.display = 'none'
  }
}

const artworkDownloader = new ArtworkDownloader()
window.artworkDownloader = artworkDownloader
