import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db/connection.js';
import { migrateDatabase } from './db/migrate.js';
import { securityHeaders, apiNotFound, errorHandler } from './lib/http.js';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/**
 * Builds the Express app. Pass `db` to reuse an open connection, or `dbPath`
 * (':memory:' in tests). Migrations are applied on startup.
 */
export function createApp({ db, dbPath = ':memory:', logger = console } = {}) {
  const database = db ?? openDatabase(dbPath);
  migrateDatabase(database);

  const app = express();
  app.disable('x-powered-by');
  app.locals.db = database;

  app.use(securityHeaders);
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', (req, res) => res.json({ data: { status: 'ok' } }));

  app.use('/api', apiNotFound);
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
  app.use(errorHandler({ logger }));

  return app;
}
