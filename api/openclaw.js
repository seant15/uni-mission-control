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
    // Prepare request options
    const requestOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
      },
    };

    // Add body for non-GET requests
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      requestOptions.body = JSON.stringify(req.body);
    }

    console.log(`[Proxy] Request:`, {
      url: targetUrl,
      method: req.method,
      hasBody: !!requestOptions.body,
    });

    // Forward the request to OpenClaw Gateway
    const response = await fetch(targetUrl, requestOptions);

    console.log(`[Proxy] Response:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    // Try to get response data
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text };
    }

    // Return the response
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Proxy Error]', error);
    res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
      stack: error.stack,
      targetUrl: targetUrl,
      env: {
        hasGatewayUrl: !!process.env.OPENCLAW_GATEWAY_URL,
        hasToken: !!process.env.OPENCLAW_GATEWAY_TOKEN,
      }
    });
  }
}
