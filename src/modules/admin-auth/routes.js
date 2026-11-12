import { Router } from 'express';
import { promisify } from 'node:util';
import { createAdminUserRepository } from './repository.js';
import { authenticate, createLoginLimiter } from './service.js';
import { requireAdmin } from './middleware.js';

/**
 * Login/logout are public. Everything else under /api/admin is guarded here, so
 * admin routes added by other modules are protected by default. Mount this router
 * before any other /api/admin routes.
 */
export function adminAuthRoutes({ db, limiter = createLoginLimiter() }) {
  const repo = createAdminUserRepository(db);
  const router = Router();

  router.post('/api/admin/login', async (req, res) => {
    const user = await authenticate(repo, limiter, req.body, req.ip);
    await promisify(req.session.regenerate.bind(req.session))();
    req.session.adminUserId = user.id;
    res.json({ data: user });
  });

  router.post('/api/admin/logout', async (req, res) => {
    await promisify(req.session.destroy.bind(req.session))();
    res.clearCookie('nmj.sid');
    res.status(204).end();
  });

  router.use('/api/admin', requireAdmin(repo));

  router.get('/api/admin/me', (req, res) => res.json({ data: req.adminUser }));

  return router;
}
