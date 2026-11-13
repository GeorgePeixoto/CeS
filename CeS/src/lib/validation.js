// Small validator toolkit. Each factory returns `(value) => normalized` and throws
// FieldError with a pt-BR message when invalid. `validate` runs a schema and collects
// all field errors into a single ValidationError.
import { ValidationError } from './errors.js';
import { isValidIsoDate } from './dates.js';

export class FieldError extends Error {}

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export function validate(input, schema) {
  const source = input && typeof input === 'object' ? input : {};
  const output = {};
  const fields = {};
  for (const [key, validator] of Object.entries(schema)) {
    try {
      output[key] = validator(source[key]);
    } catch (err) {
      if (!(err instanceof FieldError)) throw err;
      fields[key] = err.message;
    }
  }
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return output;
}

/** Wraps a validator so blank values become null. */
export function optional(validator) {
  return (value) => (isBlank(value) ? null : validator(value));
}

export function requiredString({ min = 1, max = 255 } = {}) {
  return (value) => {
    if (typeof value !== 'string' || value.trim() === '') throw new FieldError('Campo obrigatório.');
    const trimmed = value.trim();
    if (trimmed.length < min) throw new FieldError(`Use pelo menos ${min} caracteres.`);
    if (trimmed.length > max) throw new FieldError(`Use no máximo ${max} caracteres.`);
    return trimmed;
  };
}

export function optionalString({ max = 2000 } = {}) {
  return optional((value) => {
    if (typeof value !== 'string') throw new FieldError('Valor inválido.');
    const trimmed = value.trim();
    if (trimmed.length > max) throw new FieldError(`Use no máximo ${max} caracteres.`);
    return trimmed;
  });
}

export function integer({ min = -Infinity, max = Infinity } = {}) {
  return (value) => {
    if (isBlank(value)) throw new FieldError('Campo obrigatório.');
    const text = String(value).trim();
    if (!/^-?\d+$/.test(text)) throw new FieldError('Informe um número inteiro.');
    const number = Number(text);
    if (number < min) throw new FieldError(`O valor mínimo é ${min}.`);
    if (number > max) throw new FieldError(`O valor máximo é ${max}.`);
    return number;
  };
}

export function optionalInteger(options) {
  return optional(integer(options));
}

export function isoDate() {
  return (value) => {
    if (isBlank(value)) throw new FieldError('Campo obrigatório.');
    if (!isValidIsoDate(value)) throw new FieldError('Data inválida.');
    return value;
  };
}

export function optionalIsoDate() {
  return optional(isoDate());
}

export function time() {
  return (value) => {
    if (isBlank(value)) throw new FieldError('Campo obrigatório.');
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new FieldError('Horário inválido (use HH:MM).');
    }
    return value;
  };
}

export function phoneBR() {
  return (value) => {
    if (isBlank(value)) throw new FieldError('Campo obrigatório.');
    const digits = String(value).replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      throw new FieldError('Informe o telefone com DDD, por exemplo (88) 99999-1234.');
    }
    return digits;
  };
}

export function optionalPhoneBR() {
  return optional(phoneBR());
}

export function optionalEmail() {
  return optional((value) => {
    const email = String(value).trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new FieldError('E-mail inválido.');
    }
    return email;
  });
}

export function oneOf(values) {
  return (value) => {
    if (!values.includes(value)) throw new FieldError('Opção inválida.');
    return value;
  };
}

export function mustBeTrue(message = 'É preciso marcar esta opção.') {
  return (value) => {
    if (value !== true) throw new FieldError(message);
    return true;
  };
}
