// Vercel Serverless Function - API Proxy
export default async function handler(req, res) {
  // CORSヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { url, service } = req.query

  if (!url || !service) {
    res.status(400).json({ error: 'Missing url or service parameter' })
    return
  }

  // サービスごとの許可リスト
  const allowedHosts = {
    itunes: ['itunes.apple.com'],
    deezer: ['api.deezer.com'],
    lastfm: ['ws.audioscrobbler.com']
  }

  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname

    // サービスが許可リストにあるか確認
    if (!allowedHosts[service] || !allowedHosts[service].includes(hostname)) {
      res.status(403).json({ error: 'Forbidden: Invalid service or hostname' })
      return
    }

    // APIリクエストを転送
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ArtworkDownloader/1.0',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      res.status(response.status).json({ 
        error: `API request failed: ${response.statusText}` 
      })
      return
    }

    const data = await response.json()
    res.status(200).json(data)

  } catch (error) {
    console.error('Proxy error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    })
  }
}