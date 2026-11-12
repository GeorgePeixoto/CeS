import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DB_PATH || 'data/nucleo.db';

const app = createApp({ dbPath });
app.listen(port, () => {
  console.log(`Núcleo Marcus Jussier rodando em http://localhost:${port}`);
});
