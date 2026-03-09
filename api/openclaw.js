/**
 * Vercel Serverless Function - OpenClaw API Proxy
 * Proxies requests to the OpenClaw Gateway to avoid HTTPS/HTTP mixed content issues
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get OpenClaw Gateway URL from environment
  const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://open.unippc24.com:9090';
  const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'uni-random-token';

  // Extract the path from the request
  // URL will be like: /api/openclaw?path=/api/sessions/list
  const targetPath = req.query.path || '/';
  const targetUrl = `${OPENCLAW_GATEWAY_URL}${targetPath}`;

  console.log(`[Proxy] ${req.method} ${targetPath} -> ${targetUrl}`);

  try {
    // Forward the request to OpenClaw Gateway
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Get response data
    const data = await response.json();

    // Return the response
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Proxy Error]', error);
    res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
