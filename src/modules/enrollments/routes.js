import { Router } from 'express';
import { createActivitiesRepository } from '../activities/repository.js';
import { createEnrollmentsRepository } from './repository.js';
import { createEnrollmentsService } from './service.js';

export function enrollmentsRoutes({ db }) {
  const repo = createEnrollmentsRepository(db);
  const activitiesRepo = createActivitiesRepository(db);
  const service = createEnrollmentsService({ db, repo, activitiesRepo });
  const router = Router();

  // Público
  router.post('/api/activities/:id/enrollments', (req, res) => {
    const result = service.enrollPublic(req.params.id, req.body);
    res.status(201).json({ data: result });
  });

  router.get('/api/enrollments/lookup', (req, res) => {
    const result = service.lookupPublic({
      protocol: req.query.protocol,
      phone: req.query.phone,
    });
    res.json({ data: result });
  });

  // Admin — Inscrições
  router.get('/api/admin/enrollments', (req, res) => {
    const { activity, status, q } = req.query;
    res.json({ data: service.listAdminEnrollments({ activity, status, q }) });
  });

  router.post('/api/admin/enrollments/:id/status', (req, res) => {
    const updated = service.changeEnrollmentStatus(req.params.id, req.body);
    res.json({ data: updated });
  });

  router.post('/api/admin/activities/:id/enrollments', (req, res) => {
    const created = service.enrollAdmin(req.params.id, req.body);
    res.status(201).json({ data: created });
  });

  // Admin — Participantes
  router.get('/api/admin/participants', (req, res) => {
    res.json({ data: service.listParticipants({ q: req.query.q }) });
  });

  router.get('/api/admin/participants/:id', (req, res) => {
    res.json({ data: service.getParticipant(req.params.id) });
  });

  router.put('/api/admin/participants/:id', (req, res) => {
    const updated = service.updateParticipant(req.params.id, req.body);
    res.json({ data: updated });
  });

  return router;
}