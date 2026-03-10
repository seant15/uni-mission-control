/**
 * WebSocket Proxy for OpenClaw Gateway
 *
 * This proxy allows the frontend (HTTPS) to connect to OpenClaw Gateway (WS)
 * without mixed content errors by providing a WSS endpoint.
 *
 * Note: Vercel serverless functions have a 10-second timeout, so this is best
 * for short-lived connections. For long-lived connections, consider using
 * a dedicated WebSocket server.
 */

import { WebSocket } from 'ws';

const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://open.unippc24.com:9090';
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'uni-random-token';

export default async function handler(req, res) {
  // Only allow WebSocket upgrades
  if (!req.headers.upgrade || req.headers.upgrade.toLowerCase() !== 'websocket') {
    return res.status(400).json({ error: 'WebSocket upgrade required' });
  }

  const wsUrl = OPENCLAW_GATEWAY_URL.replace('https', 'wss').replace('http', 'ws');
  const targetUrl = `${wsUrl}/?token=${OPENCLAW_GATEWAY_TOKEN}`;

  console.log(`[WS Proxy] Connecting to: ${targetUrl}`);

  try {
    // Create WebSocket connection to OpenClaw Gateway
    const ws = new WebSocket(targetUrl);

    // Handle connection open
    ws.on('open', () => {
      console.log('[WS Proxy] Connected to OpenClaw Gateway');
    });

    // Forward messages from Gateway to client
    ws.on('message', (data) => {
      console.log('[WS Proxy] Gateway → Client:', data.toString());
      // Send to client via response
      res.write(data);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('[WS Proxy] Error:', error);
    });

    // Handle close
    ws.on('close', () => {
      console.log('[WS Proxy] Gateway connection closed');
      res.end();
    });

    // Handle client messages (from request body)
    req.on('data', (chunk) => {
      console.log('[WS Proxy] Client → Gateway:', chunk.toString());
      ws.send(chunk);
    });

    req.on('end', () => {
      ws.close();
    });

  } catch (error) {
    console.error('[WS Proxy] Failed to connect:', error);
    res.status(500).json({
      error: 'WebSocket proxy failed',
      message: error.message,
    });
  }
}
