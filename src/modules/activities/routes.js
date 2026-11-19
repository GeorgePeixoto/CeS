import { Router } from 'express';
import { createActivitiesRepository } from './repository.js';
import { createActivitiesService } from './service.js';

export function activitiesRoutes({ db, repo = createActivitiesRepository(db) }) {
  const service = createActivitiesService(repo);
  const router = Router();

  // Público
  router.get('/api/categories', (req, res) => {
    res.json({ data: service.listCategories() });
  });

  router.get('/api/activities', (req, res) => {
    const { q, category, type } = req.query;
    res.json({ data: service.listPublicActivities({ q, category, type }) });
  });

  router.get('/api/activities/:id', (req, res) => {
    res.json({ data: service.getPublicActivity(req.params.id) });
  });

  // Admin — Categorias
  router.get('/api/admin/categories', (req, res) => {
    res.json({ data: service.listCategories() });
  });

  router.post('/api/admin/categories', (req, res) => {
    const created = service.createCategory(req.body);
    res.status(201).json({ data: created });
  });

  router.put('/api/admin/categories/:id', (req, res) => {
    const updated = service.updateCategory(req.params.id, req.body);
    res.json({ data: updated });
  });

  // Admin — Instrutores (sem DELETE físico)
  router.get('/api/admin/instructors', (req, res) => {
    res.json({ data: service.listInstructors() });
  });

  router.post('/api/admin/instructors', (req, res) => {
    const created = service.createInstructor(req.body);
    res.status(201).json({ data: created });
  });

  router.get('/api/admin/instructors/:id', (req, res) => {
    res.json({ data: service.getInstructor(req.params.id) });
  });

  router.put('/api/admin/instructors/:id', (req, res) => {
    const updated = service.updateInstructor(req.params.id, req.body);
    res.json({ data: updated });
  });

  // Admin — Atividades
  router.get('/api/admin/activities', (req, res) => {
    res.json({ data: service.listAdminActivities() });
  });

  router.post('/api/admin/activities', (req, res) => {
    const created = service.createActivity(req.body);
    res.status(201).json({ data: created });
  });

  router.get('/api/admin/activities/:id', (req, res) => {
    res.json({ data: service.getAdminActivity(req.params.id) });
  });

  router.put('/api/admin/activities/:id', (req, res) => {
    const updated = service.updateActivity(req.params.id, req.body);
    res.json({ data: updated });
  });

  router.post('/api/admin/activities/:id/status', (req, res) => {
    const updated = service.changeActivityStatus(req.params.id, req.body);
    res.json({ data: updated });
  });

  return router;
}