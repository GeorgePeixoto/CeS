import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DB_PATH || 'data/nucleo.db';

let app;
try {
  app = createApp({ dbPath, sessionSecret: process.env.SESSION_SECRET });
} catch (err) {
  console.error(`Não foi possível iniciar: ${err.message}`);
  process.exit(1);
}
app.listen(port, () => {
  console.log(`Núcleo Marcus Jussier rodando em http://localhost:${port}`);
});
