import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { startTestApp, silentLogger } from '../helpers.js';
import { errorHandler } from '../../src/lib/http.js';
import { ValidationError, ConflictError } from '../../src/lib/errors.js';

describe('createApp', () => {
  let ctx;
  before(async () => { ctx = await startTestApp(); });
  after(() => ctx.close());

  test('GET /api/health → 200 ok', async () => {
    const res = await ctx.client().get('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { data: { status: 'ok' } });
  });

  test('unknown API route → 404 NOT_FOUND as JSON', async () => {
    const res = await ctx.client().get('/api/nao-existe');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  test('malformed JSON body → 400, not 500', async () => {
    const res = await ctx.client().post('/api/health', '{"broken":', { raw: true });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('sets basic security headers and hides x-powered-by', async () => {
    const res = await ctx.client().get('/api/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  test('serves the public home page', async () => {
    const res = await ctx.client().get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
  });
});

describe('errorHandler', () => {
  let server;
  let baseUrl;
  before(async () => {
    const app = express();
    app.get('/validation', () => { throw new ValidationError({ name: 'Obrigatório.' }); });
    app.get('/conflict', async () => { throw new ConflictError('NO_SEATS', 'Sem vagas.'); });
    app.get('/boom', async () => { throw new Error('secret internal detail'); });
    app.use(errorHandler({ logger: silentLogger }));
    server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => server.close());

  test('ValidationError → 400 with fields', async () => {
    const res = await fetch(`${baseUrl}/validation`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(body.error.fields, { name: 'Obrigatório.' });
  });

  test('async HttpError keeps its status and code', async () => {
    const res = await fetch(`${baseUrl}/conflict`);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error.code, 'NO_SEATS');
  });

  test('unexpected error → 500 without leaking details', async () => {
    const res = await fetch(`${baseUrl}/boom`);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.doesNotMatch(text, /secret internal detail|at .*\.js/);
    assert.equal(JSON.parse(text).error.code, 'INTERNAL_ERROR');
  });
});
