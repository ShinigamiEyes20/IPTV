export default async function handler(req, res) {
  const M3U_URL = process.env.M3U_URL;

  if (!M3U_URL) {
    return res.status(500).json({ error: 'M3U_URL not configured' });
  }

  try {
    const response = await fetch(M3U_URL);
    if (!response.ok) throw new Error('Upstream error');
    const text = await response.text();
    res.setHeader('Content-Type', 'application/x-mpegURL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).json({ error: 'Failed to fetch playlist' });
  }
}
