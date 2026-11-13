import bcrypt from 'bcryptjs';
import { ConflictError, UnauthorizedError, TooManyRequestsError } from '../../lib/errors.js';
import { validate, requiredString, FieldError } from '../../lib/validation.js';

export const DEFAULT_BCRYPT_COST = 12;

/** Removes secrets before a user object leaves the server. */
export const publicUser = ({ id, name, email }) => ({ id, name, email });

const requiredEmail = () => (value) => {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FieldError('E-mail inválido.');
  return email;
};

const newPassword = () => (value) => {
  if (typeof value !== 'string' || value.length < 8) {
    throw new FieldError('A senha precisa ter pelo menos 8 caracteres.');
  }
  if (value.length > 72) throw new FieldError('A senha pode ter no máximo 72 caracteres.');
  return value;
};

export async function createAdminUser(repo, input, { cost = DEFAULT_BCRYPT_COST } = {}) {
  const { name, email, password } = validate(input, {
    name: requiredString({ max: 120 }),
    email: requiredEmail(),
    password: newPassword(),
  });
  if (repo.findByEmail(email)) {
    throw new ConflictError('EMAIL_TAKEN', 'Já existe um usuário com este e-mail.');
  }
  const passwordHash = await bcrypt.hash(password, cost);
  return publicUser(repo.create({ name, email, passwordHash }));
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

/** In-memory failed-login counter per key (e-mail + IP). Resets on restart. */
export function createLoginLimiter({ max = 5, windowMs = 15 * 60_000, now = Date.now } = {}) {
  const failures = new Map(); // key -> { count, firstAt }

  const current = (key) => {
    const entry = failures.get(key);
    if (entry && now() - entry.firstAt > windowMs) {
      failures.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    isBlocked: (key) => (current(key)?.count ?? 0) >= max,
    fail(key) {
      const entry = current(key);
      if (entry) entry.count += 1;
      else failures.set(key, { count: 1, firstAt: now() });
    },
    reset: (key) => failures.delete(key),
  };
}

// Compared against when the e-mail does not exist, so both failure paths cost a bcrypt check.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);
const INVALID_CREDENTIALS = 'E-mail ou senha inválidos.';

export async function authenticate(repo, limiter, input, ip) {
  const { email, password } = validate(input, {
    email: requiredString({ max: 254 }),
    password: requiredString({ max: 72 }),
  });
  const key = `${email.toLowerCase()}|${ip}`;
  if (limiter.isBlocked(key)) throw new TooManyRequestsError();

  const user = repo.findByEmail(email);
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    limiter.fail(key);
    throw new UnauthorizedError('INVALID_CREDENTIALS', INVALID_CREDENTIALS);
  }
  limiter.reset(key);
  return publicUser(user);
}
