// Shared HTTP middleware. Express 5 forwards rejected promises from async handlers
// to the error handler, so routes can simply `throw`.
import { HttpError, NotFoundError } from './errors.js';

export function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  });
  next();
}

export function apiNotFound(req, res, next) {
  next(new NotFoundError('Recurso não encontrado.'));
}

export function errorHandler({ logger = console } = {}) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if (err instanceof HttpError) {
      const body = { code: err.code, message: err.message };
      if (err.fields) body.fields = err.fields;
      return res.status(err.status).json({ error: body });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'JSON inválido.' } });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Dados grandes demais.' } });
    }
    logger.error(err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.' },
    });
  };
}
