import { randomInt } from 'node:crypto';
import { transaction } from '../../db/connection.js';
import { ageOn, todayInFortaleza } from '../../lib/dates.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors.js';
import {
  isoDate,
  mustBeTrue,
  oneOf,
  optionalEmail,
  optionalPhoneBR,
  optionalString,
  phoneBR,
  requiredString,
  validate,
} from '../../lib/validation.js';
import { normalizePersonName } from './repository.js';

const PROTOCOL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ENROLLMENT_STATUSES = ['pending', 'confirmed', 'cancelled'];

function parsePositiveId(rawId, label = 'Registro não encontrado.') {
  const text = String(rawId ?? '').trim();
  if (!/^[1-9]\d*$/.test(text)) throw new NotFoundError(label);
  return Number(text);
}

function generateUniqueProtocol(repo) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 6; i += 1) {
      suffix += PROTOCOL_ALPHABET[randomInt(0, PROTOCOL_ALPHABET.length)];
    }
    const protocol = `NMJ-${suffix}`;
    if (!repo.protocolExists(protocol)) return protocol;
  }
  throw new Error('Não foi possível gerar protocolo único.');
}

function formatAdminEnrollment(row, today) {
  return {
    id: row.id,
    protocol: row.protocol,
    status: row.status,
    consentAt: row.consent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activity: {
      id: row.activity_id,
      title: row.activity_title,
      startDate: row.activity_start_date,
      endDate: row.activity_end_date,
    },
    participant: {
      id: row.participant_id,
      name: row.participant_name,
      phone: row.participant_phone,
      email: row.participant_email,
      birthDate: row.participant_birth_date,
      age: ageOn(row.participant_birth_date, today),
      guardianName: row.participant_guardian_name,
      guardianPhone: row.participant_guardian_phone,
    },
  };
}

function formatParticipant(row, today) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    birthDate: row.birth_date,
    age: ageOn(row.birth_date, today),
    guardianName: row.guardian_name,
    guardianPhone: row.guardian_phone,
    createdAt: row.created_at,
    ...(row.total_enrollments !== undefined
      ? {
          totalEnrollments: Number(row.total_enrollments ?? 0),
          activeEnrollments: Number(row.active_enrollments ?? 0),
        }
      : {}),
  };
}

export function createEnrollmentsService({ db, repo, activitiesRepo }) {
  function processEnrollment(rawActivityId, rawInput, { status, requireExplicitConsent, now = new Date() }) {
    const activityId = parsePositiveId(rawActivityId, 'Atividade não encontrada.');

    const schema = {
      name: requiredString({ min: 2, max: 120 }),
      phone: phoneBR(),
      email: optionalEmail(),
      birthDate: isoDate(),
      guardianName: optionalString({ max: 120 }),
      guardianPhone: optionalPhoneBR(),
    };

    if (requireExplicitConsent) {
      schema.consent = mustBeTrue('É necessário concordar com o uso dos dados para a inscrição.');
    }

    const baseData = validate(rawInput, schema);

    if (!requireExplicitConsent && rawInput?.consent === false) {
      throw new ValidationError({
        consent: 'É necessário concordar com o uso dos dados para a inscrição.',
      });
    }

    const today = todayInFortaleza(now);
    const age = ageOn(baseData.birthDate, today);
    if (age < 0) {
      throw new ValidationError({ birthDate: 'Data de nascimento não pode ser no futuro.' });
    }

    if (age < 18) {
      const guardianFields = {};
      if (!baseData.guardianName) {
        guardianFields.guardianName = 'Informe o nome do responsável legal.';
      }
      if (!baseData.guardianPhone) {
        guardianFields.guardianPhone = 'Informe o telefone do responsável legal.';
      }
      if (Object.keys(guardianFields).length > 0) {
        throw new ValidationError(guardianFields);
      }
    }

    return transaction(db, () => {
      const activity = activitiesRepo.findPublishedActivityById(activityId);
      if (!activity) {
        throw new NotFoundError('Atividade não encontrada.');
      }

      if (activity.endDate < today) {
        throw new ConflictError('ACTIVITY_ENDED', 'O período desta atividade já foi encerrado.');
      }

      if (activity.minAge !== null && activity.minAge !== undefined && age < activity.minAge) {
        throw new BadRequestError(
          'BELOW_MIN_AGE',
          `A idade mínima para esta atividade é de ${activity.minAge} anos.`,
        );
      }

      const normalizedName = normalizePersonName(baseData.name);
      let participant = repo.findParticipantByPhoneAndNormalizedName(baseData.phone, normalizedName);

      if (participant) {
        repo.updateParticipantContactAndGuardian(participant.id, {
          email: baseData.email,
          guardianName: baseData.guardianName,
          guardianPhone: baseData.guardianPhone,
        });
      } else {
        participant = repo.createParticipant(baseData);
      }

      const existingEnrollment = repo.findActiveEnrollment(activityId, participant.id);
      if (existingEnrollment) {
        throw new ConflictError(
          'ALREADY_ENROLLED',
          'Esta pessoa já possui uma inscrição ativa nesta atividade.',
        );
      }

      const activeCount = repo.countActiveByActivity(activityId);
      if (activeCount >= activity.capacity) {
        throw new ConflictError('NO_SEATS', 'Não há mais vagas disponíveis para esta atividade.');
      }

      const protocol = generateUniqueProtocol(repo);
      const enrollment = repo.createEnrollment({
        activityId,
        participantId: participant.id,
        protocol,
        status,
        consentAt: now.toISOString(),
      });

      return {
        id: enrollment.id,
        protocol: enrollment.protocol,
        status: enrollment.status,
        activity: {
          title: activity.title,
          startDate: activity.startDate,
          schedules: activity.schedules,
        },
      };
    });
  }

  return {
    enrollPublic(rawActivityId, rawInput, options = {}) {
      return processEnrollment(rawActivityId, rawInput, {
        ...options,
        status: 'pending',
        requireExplicitConsent: true,
      });
    },

    enrollAdmin(rawActivityId, rawInput, options = {}) {
      return processEnrollment(rawActivityId, rawInput, {
        ...options,
        status: 'confirmed',
        requireExplicitConsent: false,
      });
    },

    lookupPublic({ protocol, phone } = {}) {
      const normalizedProtocol = String(protocol ?? '').trim().toUpperCase();
      const normalizedPhone = String(phone ?? '').replace(/\D/g, '');

      if (!normalizedProtocol || normalizedPhone.length < 10) {
        throw new NotFoundError('Inscrição não encontrada.');
      }

      const found = repo.findEnrollmentByProtocolAndPhone(normalizedProtocol, normalizedPhone);
      if (!found) {
        throw new NotFoundError('Inscrição não encontrada.');
      }

      return found;
    },

    listAdminEnrollments({ activity, status, q } = {}, { now = new Date() } = {}) {
      const today = todayInFortaleza(now);
      let rows = repo.listAdminEnrollments({ activityId: activity, status });

      const term = normalizePersonName(q);
      const digits = String(q ?? '').replace(/\D/g, '');
      if (term || digits) {
        rows = rows.filter((row) => {
          const nameMatch = term && normalizePersonName(row.participant_name).includes(term);
          const protocolMatch = term && row.protocol.toLowerCase().includes(term);
          const phoneMatch = digits && row.participant_phone.includes(digits);
          return Boolean(nameMatch || protocolMatch || phoneMatch);
        });
      }

      return rows.map((row) => formatAdminEnrollment(row, today));
    },

    changeEnrollmentStatus(rawId, input, { now = new Date() } = {}) {
      const id = parsePositiveId(rawId, 'Inscrição não encontrada.');
      const { status: nextStatus } = validate(input, {
        status: oneOf(ENROLLMENT_STATUSES),
      });

      const current = repo.findEnrollmentById(id);
      if (!current) {
        throw new NotFoundError('Inscrição não encontrada.');
      }

      if (current.status === nextStatus) {
        return formatAdminEnrollment(current, todayInFortaleza(now));
      }

      const allowedTransitions = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['cancelled'],
        cancelled: [],
      };

      if (!allowedTransitions[current.status]?.includes(nextStatus)) {
        throw new ConflictError(
          'INVALID_STATUS_TRANSITION',
          'Não é possível alterar a inscrição para essa situação.',
        );
      }

      const updated = repo.updateEnrollmentStatus(id, nextStatus);
      return formatAdminEnrollment(updated, todayInFortaleza(now));
    },

    listParticipants({ q } = {}, { now = new Date() } = {}) {
      const today = todayInFortaleza(now);
      let rows = repo.listParticipants();

      const term = normalizePersonName(q);
      const digits = String(q ?? '').replace(/\D/g, '');
      if (term || digits) {
        rows = rows.filter((row) => {
          const nameMatch = term && normalizePersonName(row.name).includes(term);
          const phoneMatch = digits && row.phone.includes(digits);
          return Boolean(nameMatch || phoneMatch);
        });
      }

      return rows.map((row) => formatParticipant(row, today));
    },

    getParticipant(rawId, { now = new Date() } = {}) {
      const id = parsePositiveId(rawId, 'Participante não encontrado.');
      const participant = repo.findParticipantById(id);
      if (!participant) {
        throw new NotFoundError('Participante não encontrado.');
      }

      const today = todayInFortaleza(now);
      const history = repo.listEnrollmentsByParticipant(id).map((item) => ({
        id: item.id,
        protocol: item.protocol,
        status: item.status,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        activity: {
          id: item.activity_id,
          title: item.activity_title,
          type: item.activity_type,
          startDate: item.activity_start_date,
          endDate: item.activity_end_date,
        },
      }));

      return {
        ...formatParticipant(participant, today),
        enrollments: history,
      };
    },

    updateParticipant(rawId, input, { now = new Date() } = {}) {
      const id = parsePositiveId(rawId, 'Participante não encontrado.');
      const current = repo.findParticipantById(id);
      if (!current) {
        throw new NotFoundError('Participante não encontrado.');
      }

      const data = validate(input, {
        name: requiredString({ min: 2, max: 120 }),
        phone: phoneBR(),
        email: optionalEmail(),
        birthDate: isoDate(),
        guardianName: optionalString({ max: 120 }),
        guardianPhone: optionalPhoneBR(),
      });

      const today = todayInFortaleza(now);
      const age = ageOn(data.birthDate, today);
      if (age < 0) {
        throw new ValidationError({ birthDate: 'Data de nascimento não pode ser no futuro.' });
      }

      if (age < 18) {
        const guardianFields = {};
        if (!data.guardianName) {
          guardianFields.guardianName = 'Informe o nome do responsável legal.';
        }
        if (!data.guardianPhone) {
          guardianFields.guardianPhone = 'Informe o telefone do responsável legal.';
        }
        if (Object.keys(guardianFields).length > 0) {
          throw new ValidationError(guardianFields);
        }
      }

      const updated = repo.updateParticipant(id, data);
      return formatParticipant(updated, today);
    },
  };
}