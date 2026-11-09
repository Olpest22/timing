import 'dotenv/config';
import { createServer } from 'node:http';
import { app } from './app.js';
import { initRealtime } from './realtime.js';

const port = Number(process.env.PORT ?? 3000);
const server = createServer(app);
initRealtime(server);

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
