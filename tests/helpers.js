// Test helpers: boot the real app on an in-memory DB and talk to it over HTTP.
import { createApp } from '../src/app.js';

export const silentLogger = { error() {}, warn() {}, info() {}, log() {} };

export async function startTestApp(options = {}) {
  const app = createApp({ dbPath: ':memory:', logger: silentLogger, ...options });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    app,
    db: app.locals.db,
    baseUrl,
    client: () => createClient(baseUrl),
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}

/** Minimal HTTP client that keeps cookies between calls (like a browser session). */
export function createClient(baseUrl) {
  const cookies = new Map();

  async function request(method, path, body, { raw } = {}) {
    const headers = {};
    if (cookies.size) headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
      redirect: 'manual',
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
    return { status: res.status, headers: res.headers, body: json, text };
  }

  return {
    cookies,
    get: (path) => request('GET', path),
    post: (path, body, opts) => request('POST', path, body, opts),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
  };
}
