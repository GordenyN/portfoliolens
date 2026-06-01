export default async function handler(req, res) {
  const body = req.body;
  const tickers = Array.isArray(body) ? body : (body?.tickers || []);

  if (!tickers.length) {
    return res.status(400).json({ error: "tickers array required" });
  }

  try {
    const response = await fetch("https://mushamerci.app.n8n.cloud/webhook/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers })
    });

    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Proxy failed", details: error.message });
  }
}
