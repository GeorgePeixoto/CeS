import { Router } from 'express';
import { optionalInteger, optionalIsoDate, validate } from '../../lib/validation.js';
import { createReportsRepository } from './repository.js';

export function reportsRoutes({ db }) {
  const repo = createReportsRepository(db);
  const router = Router();

  router.get('/api/admin/reports/summary', (req, res) => {
    const filters = validate(
      {
        from: req.query.from,
        to: req.query.to,
        category: req.query.category,
      },
      {
        from: optionalIsoDate(),
        to: optionalIsoDate(),
        category: optionalInteger({ min: 1 }),
      },
    );

    const summary = repo.getSummary({
      from: filters.from,
      to: filters.to,
      categoryId: filters.category,
    });

    res.json({ data: summary });
  });

  return router;
}