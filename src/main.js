import './style.css'
import LastFmAPI from './lastfm.js'
import DeezerAPI from './deezer.js'

class ArtworkDownloader {
  constructor() {
    this.initEventListeners()
    this.pendingRequests = new Map() // JSONP リクエスト管理
    this.callbackCounter = 0 // 一意なコールバック名生成
    
    // 代替API
    this.lastfmAPI = new LastFmAPI()
    this.deezerAPI = new DeezerAPI()
    
    // 本番環境の検出
    this.isProduction = window.location.hostname !== 'localhost' && 
                       window.location.hostname !== '127.0.0.1'
    
    // デバッグログ機能
    this.debugMode = localStorage.getItem('debug_mode') === 'true'
  }

  initEventListeners() {
    const searchForm = document.getElementById('search-form')
    searchForm.addEventListener('submit', this.handleSearch.bind(this))
    
    // API設定モーダル
    const apiSettingsBtn = document.getElementById('api-settings-btn')
    const apiSettingsModal = document.getElementById('api-settings-modal')
    const saveApiSettingsBtn = document.getElementById('save-api-settings')
    const closeApiSettingsBtn = document.getElementById('close-api-settings')
    const showErrorLogsBtn = document.getElementById('show-error-logs')
    
    apiSettingsBtn.addEventListener('click', () => {
      this.showApiSettings()
    })
    
    saveApiSettingsBtn.addEventListener('click', () => {
      this.saveApiSettings()
    })
    
    closeApiSettingsBtn.addEventListener('click', () => {
      this.hideApiSettings()
    })
    
    showErrorLogsBtn.addEventListener('click', () => {
      this.showErrorLogs()
    })
    
    // モーダル外クリックで閉じる
    apiSettingsModal.addEventListener('click', (e) => {
      if (e.target === apiSettingsModal) {
        this.hideApiSettings()
      }
    })
    
    // 保存されたAPIキーを読み込む
    this.loadApiSettings()
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
    const errors = []
    const searchContext = { artist, song, timestamp: new Date().toISOString() }

    this.debugLog('SEARCH', 'Started', searchContext)

    // iTunes API
    try {
      this.debugLog('iTunes', 'Starting search', { artist, song })
      const itunesResults = await this.searchiTunes(artist, song)
      artworks.push(...itunesResults)
      this.debugLog('iTunes', 'Success', { resultCount: itunesResults.length })
    } catch (error) {
      this.errorLog('iTunes', 'Search failed', error, searchContext)
      errors.push('iTunes')
    }

    // Deezer API（iTunesが失敗または結果が少ない場合）
    if (artworks.length < 6) {
      try {
        this.debugLog('Deezer', 'Starting search', { artist, song, currentResults: artworks.length })
        const deezerResults = await this.deezerAPI.search(artist, song)
        artworks.push(...deezerResults)
        this.debugLog('Deezer', 'Success', { resultCount: deezerResults.length, totalResults: artworks.length })
      } catch (error) {
        this.errorLog('Deezer', 'Search failed', error, searchContext)
        errors.push('Deezer')
      }
    }

    // Last.fm API（まだ結果が少ない場合）
    if (artworks.length < 6) {
      try {
        this.debugLog('Last.fm', 'Starting search', { artist, song, currentResults: artworks.length })
        const lastfmResults = await this.lastfmAPI.search(artist, song)
        artworks.push(...lastfmResults)
        this.debugLog('Last.fm', 'Success', { resultCount: lastfmResults.length, totalResults: artworks.length })
      } catch (error) {
        this.errorLog('Last.fm', 'Search failed', error, searchContext)
        errors.push('Last.fm')
      }
    }

    // 全てのAPIが失敗した場合
    if (artworks.length === 0 && errors.length >= 3) {
      const finalError = new Error('全ての音楽サービスへの接続に失敗しました')
      this.errorLog('SEARCH', 'All APIs failed', finalError, { errors, searchContext })
      throw finalError
    }

    // 重複を除去（同じ画像URLを持つものを削除）
    const uniqueArtworks = new Map()
    artworks.forEach(artwork => {
      if (!uniqueArtworks.has(artwork.imageUrl)) {
        uniqueArtworks.set(artwork.imageUrl, artwork)
      }
    })

    const finalResults = Array.from(uniqueArtworks.values())
    this.debugLog('SEARCH', 'Completed', { 
      totalFound: artworks.length, 
      uniqueResults: finalResults.length,
      failedServices: errors 
    })

    return finalResults
  }

  // JSONP でiTunes APIを呼び出し
  jsonpRequest(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const callbackName = `iTunes_callback_${++this.callbackCounter}`
      const script = document.createElement('script')
      
      // URLの検証 - iTunes APIのみ許可
      try {
        const parsedUrl = new URL(url)
        if (!parsedUrl.hostname.endsWith('apple.com')) {
          reject(new Error('許可されていないURLです'))
          return
        }
      } catch (e) {
        reject(new Error('無効なURLです'))
        return
      }
      
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
        
        let data
        
        if (this.isProduction) {
          // 本番環境：プロキシを使用
          try {
            this.debugLog('iTunes', 'Using proxy', { url })
            const proxyUrl = `/api/proxy?service=itunes&url=${encodeURIComponent(url)}`
            const response = await fetch(proxyUrl)
            if (!response.ok) {
              throw new Error(`Proxy error: ${response.statusText}`)
            }
            data = await response.json()
            this.debugLog('iTunes', 'Proxy success', { resultCount: data.results?.length || 0 })
          } catch (proxyError) {
            this.debugLog('iTunes', 'Proxy failed, fallback to JSONP', { error: proxyError.message })
            data = await this.jsonpRequest(url)
          }
        } else {
          // 開発環境：直接JSONP
          this.debugLog('iTunes', 'Using JSONP', { url })
          data = await this.jsonpRequest(url)
        }
        
        if (data.results && data.results.length > 0) {
          const uniqueArtworks = new Map()
          
          data.results.forEach(item => {
            if (item.artworkUrl100) {
              const artworkUrl300 = item.artworkUrl100.replace('100x100bb', '300x300bb')
              const artworkUrlLarge = item.artworkUrl100.replace('100x100bb', '1200x1200bb')
              
              const key = artworkUrl300
              
              if (!uniqueArtworks.has(key)) {
                uniqueArtworks.set(key, {
                  title: item.trackName || item.collectionName || 'Unknown',
                  artist: item.artistName || 'Unknown Artist',
                  album: item.collectionName || '',
                  imageUrl: artworkUrl300, // サムネイル用は300x300
                  downloadUrl: artworkUrlLarge, // ダウンロード用は1200x1200
                  source: 'iTunes',
                  resolution: '300x300'
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

    // 画像要素を作成
    const img = document.createElement('img')
    img.src = artwork.imageUrl
    img.alt = `${artwork.title} - ${artwork.artist}`
    img.className = 'artwork-image'
    img.loading = 'lazy'
    img.onerror = function() {
      this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='
    }
    img.addEventListener('click', () => {
      // モーダル用には高解像度版を使用
      const modalArtwork = { ...artwork }
      if (artwork.downloadUrl) {
        modalArtwork.imageUrl = artwork.downloadUrl
      }
      this.showImageModal(modalArtwork)
    })

    // 情報セクションを作成
    const infoDiv = document.createElement('div')
    infoDiv.className = 'artwork-info'

    const title = document.createElement('h3')
    title.textContent = artwork.title
    infoDiv.appendChild(title)

    const artistP = document.createElement('p')
    artistP.textContent = `アーティスト: ${artwork.artist}`
    infoDiv.appendChild(artistP)

    if (artwork.album) {
      const albumP = document.createElement('p')
      albumP.textContent = `アルバム: ${artwork.album}`
      infoDiv.appendChild(albumP)
    }

    const resolutionP = document.createElement('p')
    resolutionP.textContent = `解像度: ${artwork.resolution}`
    infoDiv.appendChild(resolutionP)

    const sourceBadge = document.createElement('span')
    sourceBadge.className = 'source-badge'
    sourceBadge.textContent = artwork.source
    infoDiv.appendChild(sourceBadge)

    // ダウンロードボタンを作成
    const downloadBtn = document.createElement('button')
    downloadBtn.className = 'download-btn'
    downloadBtn.textContent = '📥 ダウンロード (JPG)'
    downloadBtn.addEventListener('click', () => {
      // ダウンロード用URLがある場合は使用、なければ表示用URLを使用
      const downloadUrl = artwork.downloadUrl || artwork.imageUrl
      this.downloadArtwork(downloadUrl, artwork.artist, artwork.title, index)
    })

    // カードに要素を追加
    card.appendChild(img)
    card.appendChild(infoDiv)
    card.appendChild(downloadBtn)

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

  // デバッグログ関数
  debugLog(service, action, details) {
    if (this.debugMode || !this.isProduction) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] ${service} - ${action}:`, details)
    }
  }

  // エラーログ関数
  errorLog(service, action, error, context = {}) {
    const timestamp = new Date().toISOString()
    const errorInfo = {
      timestamp,
      service,
      action,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      isProduction: this.isProduction
    }
    
    console.error(`[${timestamp}] ERROR ${service} - ${action}:`, errorInfo)
    
    // 本番環境では詳細なエラー情報をLocalStorageに保存（デバッグ用）
    if (this.isProduction) {
      try {
        const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]')
        existingLogs.push(errorInfo)
        // 最新の50件まで保持
        const recentLogs = existingLogs.slice(-50)
        localStorage.setItem('error_logs', JSON.stringify(recentLogs))
      } catch (e) {
        console.warn('エラーログの保存に失敗:', e)
      }
    }
  }

  showApiSettings() {
    const modal = document.getElementById('api-settings-modal')
    modal.style.display = 'flex'
    
    // 現在の設定を表示
    const lastfmKey = localStorage.getItem('lastfm_api_key') || ''
    document.getElementById('lastfm-api-key').value = lastfmKey
    
    // デバッグモードの状態を表示
    const debugMode = localStorage.getItem('debug_mode') === 'true'
    document.getElementById('debug-mode').checked = debugMode
  }

  hideApiSettings() {
    document.getElementById('api-settings-modal').style.display = 'none'
  }

  saveApiSettings() {
    const lastfmKey = document.getElementById('lastfm-api-key').value.trim()
    const debugMode = document.getElementById('debug-mode').checked
    
    // LocalStorageに保存（注意: より安全な方法として、バックエンドでの管理を推奨）
    if (lastfmKey) {
      try {
        // 簡易的な検証（実際のAPIキーは32文字の16進数）
        if (lastfmKey.length !== 32 || !/^[a-f0-9]+$/i.test(lastfmKey)) {
          this.showError('無効なAPIキー形式です（32文字の16進数である必要があります）')
          return
        }
        localStorage.setItem('lastfm_api_key', lastfmKey)
        this.lastfmAPI.apiKey = lastfmKey
      } catch (e) {
        this.showError('APIキーの保存に失敗しました')
        return
      }
    } else {
      localStorage.removeItem('lastfm_api_key')
      this.lastfmAPI.apiKey = null
    }
    
    // デバッグモードの保存
    localStorage.setItem('debug_mode', debugMode.toString())
    this.debugMode = debugMode
    
    this.hideApiSettings()
    this.showSuccess('API設定を保存しました')
  }

  loadApiSettings() {
    const lastfmKey = localStorage.getItem('lastfm_api_key')
    if (lastfmKey) {
      this.lastfmAPI.apiKey = lastfmKey
    }
  }

  showSuccess(message) {
    const successDiv = document.createElement('div')
    successDiv.className = 'success-message'
    successDiv.textContent = '✅ ' + message
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 1000;
    `
    document.body.appendChild(successDiv)
    
    setTimeout(() => {
      document.body.removeChild(successDiv)
    }, 3000)
  }

  // エラーログを表示
  showErrorLogs() {
    try {
      const logs = JSON.parse(localStorage.getItem('error_logs') || '[]')
      
      if (logs.length === 0) {
        alert('エラーログはありません')
        return
      }
      
      // エラーログをコンソールに出力
      console.group('🐛 Error Logs')
      logs.forEach((log, index) => {
        console.group(`${index + 1}. ${log.service} - ${log.action} (${log.timestamp})`)
        console.log('Error:', log.error)
        console.log('Context:', log.context)
        console.log('Environment:', {
          userAgent: log.userAgent,
          url: log.url,
          isProduction: log.isProduction
        })
        console.groupEnd()
      })
      console.groupEnd()
      
      // ユーザーに通知
      const logCount = logs.length
      const latestLog = logs[logs.length - 1]
      alert(`エラーログ ${logCount} 件をコンソールに出力しました。\n\n最新のエラー:\n${latestLog.service} - ${latestLog.action}\n${latestLog.error.message}\n\n詳細は開発者ツールのコンソールを確認してください。`)
      
    } catch (e) {
      console.error('エラーログの読み取りに失敗:', e)
      alert('エラーログの読み取りに失敗しました')
    }
  }
}

const artworkDownloader = new ArtworkDownloader()
window.artworkDownloader = artworkDownloader
