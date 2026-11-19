import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import {
  FieldError,
  optionalEmail,
  optionalPhoneBR,
  optionalString,
  requiredString,
  validate,
} from '../../lib/validation.js';
import { validateActivityInput, validateActivityStatus } from './validation.js';

function parsePositiveId(rawId) {
  const text = String(rawId ?? '').trim();
  if (!/^[1-9]\d*$/.test(text)) throw new NotFoundError();
  return Number(text);
}

function optionalBoolean(defaultValue = true) {
  return (value) => {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    throw new FieldError('Valor booleano inválido.');
  };
}

function collectReferenceErrors(repo, { categoryId, instructorId }) {
  const fields = {};

  if (categoryId !== undefined && !repo.findCategoryById(categoryId)) {
    fields.categoryId = 'Categoria não encontrada.';
  }

  if (instructorId !== null && instructorId !== undefined) {
    const instructor = repo.findInstructorById(instructorId);
    if (!instructor) {
      fields.instructorId = 'Instrutor não encontrado.';
    } else if (!instructor.active) {
      fields.instructorId = 'Selecione um instrutor ativo.';
    }
  }

  return fields;
}

export function createActivitiesService(repo) {
  return {
    // Categories
    listCategories() {
      return repo.listCategories();
    },

    createCategory(input) {
      const data = validate(input, {
        name: requiredString({ min: 2, max: 80 }),
      });

      const existing = repo.findCategoryByName(data.name);
      if (existing) {
        throw new ConflictError('DUPLICATE_CATEGORY', 'Já existe uma categoria com esse nome.');
      }

      return repo.createCategory(data);
    },

    updateCategory(rawId, input) {
      const id = parsePositiveId(rawId);
      const current = repo.findCategoryById(id);
      if (!current) throw new NotFoundError('Categoria não encontrada.');

      const data = validate(input, {
        name: requiredString({ min: 2, max: 80 }),
      });

      const existing = repo.findCategoryByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictError('DUPLICATE_CATEGORY', 'Já existe uma categoria com esse nome.');
      }

      return repo.updateCategory(id, data);
    },

    // Instructors
    listInstructors() {
      return repo.listInstructors();
    },

    getInstructor(rawId) {
      const id = parsePositiveId(rawId);
      const instructor = repo.findInstructorById(id);
      if (!instructor) throw new NotFoundError('Instrutor não encontrado.');
      return instructor;
    },

    createInstructor(input) {
      const data = validate(input, {
        name: requiredString({ min: 2, max: 120 }),
        bio: optionalString({ max: 1000 }),
        phone: optionalPhoneBR(),
        email: optionalEmail(),
        active: optionalBoolean(true),
      });

      return repo.createInstructor(data);
    },

    updateInstructor(rawId, input) {
      const id = parsePositiveId(rawId);
      const current = repo.findInstructorById(id);
      if (!current) throw new NotFoundError('Instrutor não encontrado.');

      const data = validate(input, {
        name: requiredString({ min: 2, max: 120 }),
        bio: optionalString({ max: 1000 }),
        phone: optionalPhoneBR(),
        email: optionalEmail(),
        active: optionalBoolean(current.active),
      });

      return repo.updateInstructor(id, data);
    },

    // Activities (Admin)
    listAdminActivities() {
      return repo.listAllActivities();
    },

    getAdminActivity(rawId) {
      const id = parsePositiveId(rawId);
      const activity = repo.findActivityById(id);
      if (!activity) throw new NotFoundError('Atividade não encontrada.');
      return activity;
    },

    createActivity(input) {
      const { data, fields } = validateActivityInput(input);
      Object.assign(fields, collectReferenceErrors(repo, data));
      if (Object.keys(fields).length > 0) throw new ValidationError(fields);

      return repo.createActivity(data);
    },

    updateActivity(rawId, input) {
      const id = parsePositiveId(rawId);
      const current = repo.findActivityById(id);
      if (!current) throw new NotFoundError('Atividade não encontrada.');

      const { data, fields } = validateActivityInput(input);
      Object.assign(fields, collectReferenceErrors(repo, data));
      if (Object.keys(fields).length > 0) throw new ValidationError(fields);

      const activeEnrollments = repo.countActiveEnrollments(id);
      if (data.capacity < activeEnrollments) {
        throw new ConflictError(
          'CAPACITY_BELOW_ENROLLED',
          `A capacidade não pode ser menor que os ${activeEnrollments} inscritos ativos.`,
        );
      }

      return repo.updateActivity(id, data);
    },

    changeActivityStatus(rawId, input) {
      const id = parsePositiveId(rawId);
      const current = repo.findActivityById(id);
      if (!current) throw new NotFoundError('Atividade não encontrada.');

      const { status } = validateActivityStatus(input);
      return repo.updateActivityStatus(id, status);
    },

    // Activities (Public)
    listPublicActivities({ q, category, type } = {}) {
      return repo.listPublishedActivities({ q, category, type });
    },

    getPublicActivity(rawId) {
      const id = parsePositiveId(rawId);
      const activity = repo.findPublishedActivityById(id);
      if (!activity) throw new NotFoundError('Atividade não encontrada.');
      return activity;
    },
  };
}