// Cache in-memory for the duration of the serverless function warm instance
let cache = { ts: 0, data: null };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  const M3U_URL = process.env.M3U_URL;

  if (!M3U_URL) {
    return res.status(500).json({ error: 'M3U_URL not configured' });
  }

  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Serve from cache if fresh
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) {
    res.setHeader('Content-Type', 'application/x-mpegURL');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).send(cache.data);
  }

  try {
    const response = await fetch(M3U_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JetTV/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`Upstream ${response.status}`);

    const text = await response.text();

    // Update cache
    cache = { ts: now, data: text };

    res.setHeader('Content-Type', 'application/x-mpegURL');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).send(text);
  } catch (e) {
    // Serve stale cache on error rather than failing
    if (cache.data) {
      res.setHeader('Content-Type', 'application/x-mpegURL');
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).send(cache.data);
    }
    return res.status(502).json({ error: 'Failed to fetch playlist', detail: e.message });
  }
}
