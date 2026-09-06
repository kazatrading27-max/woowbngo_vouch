import 'dotenv/config';
import { createApp } from './setup';

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT || 3001);
  console.log(`API listening on http://localhost:${process.env.PORT || 3001}/api`);
}
bootstrap();
