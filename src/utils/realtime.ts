import { Response } from 'express';

interface RealtimeClient {
  res: Response;
  userId?: number;
}

const clients = new Set<RealtimeClient>();

export function registerRealtimeClient(res: Response, userId?: number) {
  const client: RealtimeClient = { res, userId };
  clients.add(client);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write('data: ' + JSON.stringify({ type: 'connected', time: Date.now() }) + '\n\n');

  // Heartbeat ping mỗi 20 giây để giữ kết nối trên Render / Cloudflare
  const interval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(interval);
      clients.delete(client);
    }
  }, 20000);

  res.on('close', () => {
    clearInterval(interval);
    clients.delete(client);
  });
}

export function broadcastNewClick(clickData: any) {
  const payload = 'data: ' + JSON.stringify({ type: 'new_click', click: clickData }) + '\n\n';
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}
