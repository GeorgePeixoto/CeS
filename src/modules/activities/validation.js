import { ValidationError } from '../../lib/errors.js';
import {
  FieldError,
  integer,
  isoDate,
  oneOf,
  optionalInteger,
  optionalString,
  requiredString,
  time,
  validate,
} from '../../lib/validation.js';

export const ACTIVITY_TYPES = ['workshop', 'course', 'event'];
export const ACTIVITY_STATUSES = ['draft', 'published', 'cancelled'];

function pick(obj, camelKey, snakeKey) {
  if (!obj || typeof obj !== 'object') return undefined;
  return obj[camelKey] !== undefined ? obj[camelKey] : obj[snakeKey];
}

export function validateActivityInput(rawInput) {
  const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
  const useSnake =
    input.start_date !== undefined ||
    input.end_date !== undefined ||
    input.category_id !== undefined ||
    input.min_age !== undefined;

  const schema = {
    title: requiredString({ min: 3, max: 120 }),
    description: optionalString({ max: 2000 }),
    type: oneOf(ACTIVITY_TYPES),
    categoryId: integer({ min: 1 }),
    instructorId: optionalInteger({ min: 1 }),
    location: optionalString({ max: 200 }),
    startDate: isoDate(),
    endDate: isoDate(),
    capacity: integer({ min: 1, max: 500 }),
    minAge: optionalInteger({ min: 0, max: 120 }),
  };

  const normalized = {
    title: input.title,
    description: input.description,
    type: input.type,
    categoryId: pick(input, 'categoryId', 'category_id'),
    instructorId: pick(input, 'instructorId', 'instructor_id'),
    location: input.location,
    startDate: pick(input, 'startDate', 'start_date'),
    endDate: pick(input, 'endDate', 'end_date'),
    capacity: input.capacity,
    minAge: pick(input, 'minAge', 'min_age'),
  };

  const data = {};
  const fields = {};

  for (const [key, validator] of Object.entries(schema)) {
    try {
      data[key] = validator(normalized[key]);
    } catch (err) {
      if (!(err instanceof FieldError)) throw err;
      fields[key] = err.message;
    }
  }

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    fields[useSnake ? 'end_date' : 'endDate'] = 'A data de término deve ser igual ou posterior ao início.';
  }

  const rawSchedules = input.schedules;
  const schedules = [];

  if (!Array.isArray(rawSchedules) || rawSchedules.length === 0) {
    fields.schedules = 'Informe pelo menos um horário.';
  } else {
    rawSchedules.forEach((item, index) => {
      const schedInput = {
        weekday: item?.weekday,
        startTime: pick(item, 'startTime', 'start_time'),
        endTime: pick(item, 'endTime', 'end_time'),
      };

      try {
        const parsed = validate(schedInput, {
          weekday: integer({ min: 0, max: 6 }),
          startTime: time(),
          endTime: time(),
        });

        if (parsed.endTime <= parsed.startTime) {
          fields[`schedules.${index}.endTime`] = 'O horário de término deve ser depois do início.';
        } else {
          schedules.push(parsed);
        }
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        for (const [subKey, msg] of Object.entries(err.fields)) {
          fields[`schedules.${index}.${subKey}`] = msg;
        }
      }
    });
  }

  if (useSnake) {
    if (fields.categoryId) {
      fields.category_id = fields.categoryId;
      delete fields.categoryId;
    }
    if (fields.instructorId) {
      fields.instructor_id = fields.instructorId;
      delete fields.instructorId;
    }
    if (fields.startDate) {
      fields.start_date = fields.startDate;
      delete fields.startDate;
    }
    if (fields.minAge) {
      fields.min_age = fields.minAge;
      delete fields.minAge;
    }
  }

  return { data: { ...data, schedules }, fields };
}

export function validateActivityStatus(input) {
  return validate(input, {
    status: oneOf(ACTIVITY_STATUSES),
  });
}

export { FieldError };