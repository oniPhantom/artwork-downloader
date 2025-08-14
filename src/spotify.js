// Spotify Web API integration (未実装)
// 注意: Spotify APIはクライアントサイドでの認証に制限があるため、
// 実際に使用する場合はバックエンドサーバーが必要です
class SpotifyAPI {
  constructor() {
    this.accessToken = null
    this.tokenExpiry = null
  }

  // 現在は未実装
  async search(artist, song) {
    console.warn('Spotify API統合は現在未実装です')
    return []
  }
}

export default SpotifyAPI