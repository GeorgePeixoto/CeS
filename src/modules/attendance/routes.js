import { Router } from 'express';
import { todayInFortaleza } from '../../lib/dates.js';
import { BadRequestError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { createActivitiesRepository } from '../activities/repository.js';
import { createAttendanceRepository } from './repository.js';
import { listSessionDates } from './sessions.js';

function parsePositiveId(rawId) {
  const text = String(rawId ?? '').trim();
  if (!/^[1-9]\d*$/.test(text)) throw new NotFoundError('Atividade não encontrada.');
  return Number(text);
}

function assertValidSessionDate(activity, rawDate, now = new Date()) {
  const date = String(rawDate ?? '').trim();
  const validDates = listSessionDates(activity);
  const today = todayInFortaleza(now);

  if (!date || !validDates.includes(date) || date > today) {
    throw new BadRequestError(
      'INVALID_SESSION_DATE',
      'Data inválida: selecione uma data de encontro da atividade até hoje.',
    );
  }

  return date;
}

export function attendanceRoutes({ db }) {
  const activitiesRepo = createActivitiesRepository(db);
  const repo = createAttendanceRepository(db);
  const router = Router();

  // Lista datas de encontro da atividade com flag recorded
  router.get('/api/admin/activities/:id/sessions', (req, res) => {
    const activityId = parsePositiveId(req.params.id);
    const activity = activitiesRepo.findActivityById(activityId);
    if (!activity) throw new NotFoundError('Atividade não encontrada.');

    const dates = listSessionDates(activity);
    const recordedSet = repo.listRecordedDates(activityId);

    res.json({
      data: dates.map((date) => ({
        date,
        recorded: recordedSet.has(date),
      })),
    });
  });

  // Lista inscritos confirmados para a data + contagem de pendentes
  router.get('/api/admin/activities/:id/attendance', (req, res) => {
    const activityId = parsePositiveId(req.params.id);
    const activity = activitiesRepo.findActivityById(activityId);
    if (!activity) throw new NotFoundError('Atividade não encontrada.');

    const date = assertValidSessionDate(activity, req.query.date);
    const items = repo.listConfirmedRosterForDate(activityId, date);
    const pendingCount = repo.countPendingEnrollments(activityId);

    res.json({
      data: {
        date,
        pendingCount,
        records: items,
      },
    });
  });

  // Salva a chamada inteira em transação (upsert)
  router.put('/api/admin/activities/:id/attendance', (req, res) => {
    const activityId = parsePositiveId(req.params.id);
    const activity = activitiesRepo.findActivityById(activityId);
    if (!activity) throw new NotFoundError('Atividade não encontrada.');

    const date = assertValidSessionDate(activity, req.query.date);
    const rawRecords = req.body?.records;

    if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
      throw new ValidationError({ records: 'Informe os registros de presença.' });
    }

    const validEnrollmentIds = repo.listConfirmedEnrollmentIds(activityId);
    const seenIds = new Set();
    const normalizedRecords = [];

    for (const item of rawRecords) {
      const enrollmentId = Number(item?.enrollmentId);
      if (!Number.isInteger(enrollmentId) || !validEnrollmentIds.has(enrollmentId)) {
        throw new BadRequestError(
          'INVALID_ENROLLMENT',
          'Todas as inscrições devem estar confirmadas nesta atividade.',
        );
      }
      if (typeof item?.present !== 'boolean') {
        throw new ValidationError({ present: 'O campo present deve ser booleano (true ou false).' });
      }
      if (seenIds.has(enrollmentId)) {
        throw new BadRequestError('DUPLICATE_ENROLLMENT', 'Inscrição duplicada na lista de chamada.');
      }
      seenIds.add(enrollmentId);
      normalizedRecords.push({ enrollmentId, present: item.present });
    }

    repo.saveAttendanceBatch(date, normalizedRecords);

    const updatedRoster = repo.listConfirmedRosterForDate(activityId, date);
    const presentCount = updatedRoster.filter((r) => r.present === true).length;
    const absentCount = updatedRoster.filter((r) => r.present === false).length;

    res.json({
      data: {
        date,
        total: updatedRoster.length,
        presentCount,
        absentCount,
        records: updatedRoster,
      },
    });
  });

  return router;
}