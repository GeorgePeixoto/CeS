// HTTP-aware errors. `message` is user-facing (pt-BR); `code` is a stable English constant.

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

export class ValidationError extends HttpError {
  constructor(fields = {}, message = 'Verifique os campos destacados.') {
    super(400, 'VALIDATION_ERROR', message, { fields });
  }
}

export class BadRequestError extends HttpError {
  constructor(code = 'BAD_REQUEST', message = 'Requisição inválida.') {
    super(400, code, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(code = 'UNAUTHORIZED', message = 'Faça login para continuar.') {
    super(401, code, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Não encontrado.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends HttpError {
  constructor(code = 'CONFLICT', message = 'Conflito com o estado atual.') {
    super(409, code, message);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Muitas tentativas. Aguarde alguns minutos.') {
    super(429, 'TOO_MANY_ATTEMPTS', message);
  }
}
