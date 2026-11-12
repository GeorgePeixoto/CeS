import bcrypt from 'bcryptjs';
import { ConflictError } from '../../lib/errors.js';
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
