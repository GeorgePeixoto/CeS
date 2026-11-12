import session from 'express-session';
import { UnauthorizedError } from '../../lib/errors.js';
import { publicUser } from './service.js';

const EIGHT_HOURS = 8 * 60 * 60 * 1000;

export function sessionMiddleware(secret) {
  if (!secret) {
    throw new Error('SESSION_SECRET não definido. Copie .env.example para .env e preencha o valor.');
  }
  return session({
    name: 'nmj.sid',
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: EIGHT_HOURS,
    },
  });
}

/** Rejects requests without a logged-in admin; exposes the user as req.adminUser. */
export function requireAdmin(repo) {
  return (req, res, next) => {
    const user = req.session?.adminUserId && repo.findById(req.session.adminUserId);
    if (!user) return next(new UnauthorizedError());
    req.adminUser = publicUser(user);
    return next();
  };
}
