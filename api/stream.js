export default async function handler(req, res) {
  const M3U_URL = process.env.M3U_URL;

  if (!M3U_URL) {
    return res.status(500).json({ error: 'M3U_URL not configured' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;

  // Proxy a specific stream or segment URL
  if (url) {
    try {
      const streamUrl = decodeURIComponent(url);
      const response = await fetch(streamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': '',
          'Origin': '',
        }
      });

      if (!response.ok) throw new Error('Stream fetch failed');

      const contentType = response.headers.get('content-type') || 'application/x-mpegURL';
      res.setHeader('Content-Type', contentType);

      const text = await response.text();

      // Rewrite inner m3u8 segment URLs through proxy too
      if (contentType.includes('mpegURL') || streamUrl.includes('.m3u8')) {
        const base = new URL(streamUrl);
        const rewritten = text.split('\n').map(line => {
          const t = line.trim();
          if (!t || t.startsWith('#')) return line;
          let absUrl = t.startsWith('http') ? t : new URL(t, base).toString();
          return `/api/stream?url=${encodeURIComponent(absUrl)}`;
        }).join('\n');
        return res.status(200).send(rewritten);
      }

      return res.status(200).send(text);
    } catch (e) {
      return res.status(502).json({ error: 'Stream proxy failed: ' + e.message });
    }
  }

  // Fetch main M3U playlist and rewrite stream URLs through proxy
  try {
    const response = await fetch(M3U_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    if (!response.ok) throw new Error('Upstream error');
    const text = await response.text();

    const rewritten = text.split('\n').map(line => {
      const t = line.trim();
      if (t.startsWith('http') && !t.startsWith('#')) {
        return `/api/stream?url=${encodeURIComponent(t)}`;
      }
      return line;
    }).join('\n');

    res.setHeader('Content-Type', 'application/x-mpegURL');
    res.status(200).send(rewritten);
  } catch (e) {
    res.status(502).json({ error: 'Failed to fetch playlist' });
  }
}
