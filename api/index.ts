import 'dotenv/config';
import { createServer, RequestListener } from 'http';
import { ExpressAdapter } from '@nestjs/platform-express';
import { createApp } from './src/setup';
import express from 'express';

const server = express();
server.disable('x-powered-by');

let cachedHandler: RequestListener | null = null;

async function bootstrap(): Promise<RequestListener> {
  if (cachedHandler) return cachedHandler;
  const adapter = new ExpressAdapter(server);
  const app = await createApp(adapter);
  await app.init();
  cachedHandler = server;
  return cachedHandler;
}

export default async function handler(req: any, res: any) {
  const app = await bootstrap();
  app(req, res);
}

if (require.main === module) {
  (async () => {
    const app = await bootstrap();
    const port = process.env.PORT || 3001;
    createServer(app).listen(port, () => {
      console.log(`API listening on http://localhost:${port}/api`);
    });
  })();
}
