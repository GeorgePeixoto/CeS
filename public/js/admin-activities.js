import {
  api,
  clearFieldErrors,
  escapeHtml,
  handleFormError,
  showAlert,
} from './api.js';
import {
  formatActivityType,
  formatDateRange,
  formatSchedules,
} from './format.js';

const activitiesAlertEl = document.querySelector('#activities-alert');
const activityForm = document.querySelector('#activity-form');
const activityFormTitleEl = document.querySelector('#activity-form-title');
const activitySubmitBtn = document.querySelector('#activity-submit');
const activityCancelEditBtn = document.querySelector('#activity-cancel-edit');
const categorySelect = document.querySelector('#activity-category');
const instructorSelect = document.querySelector('#activity-instructor');
const schedulesListEl = document.querySelector('#schedules-list');
const addScheduleBtn = document.querySelector('#add-schedule-btn');
const activitiesTbody = document.querySelector('#activities-tbody');
const activitiesTableWrap = document.querySelector('#activities-table-wrap');
const activitiesEmptyEl = document.querySelector('#activities-empty');

const categoriesAlertEl = document.querySelector('#categories-alert');
const categoryForm = document.querySelector('#category-form');
const categorySubmitBtn = document.querySelector('#category-submit');
const categoryCancelEditBtn = document.querySelector('#category-cancel-edit');
const categoriesListEl = document.querySelector('#categories-list');

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

const STATUS_BADGES = {
  draft: '<span class="badge badge-warning">Rascunho</span>',
  published: '<span class="badge badge-success">Publicada</span>',
  cancelled: '<span class="badge badge-danger">Cancelada</span>',
};

let categoriesCache = [];
let instructorsCache = [];
let activitiesCache = [];

function reindexScheduleRows() {
  const rows = [...schedulesListEl.querySelectorAll('[data-schedule-row]')];
  rows.forEach((row, index) => {
    const weekdayEl = row.querySelector('[data-field="weekday"]');
    const startEl = row.querySelector('[data-field="startTime"]');
    const endEl = row.querySelector('[data-field="endTime"]');
    const removeBtn = row.querySelector('[data-remove-schedule]');

    if (weekdayEl) weekdayEl.name = `schedules.${index}.weekday`;
    if (startEl) startEl.name = `schedules.${index}.startTime`;
    if (endEl) endEl.name = `schedules.${index}.endTime`;
    if (removeBtn) removeBtn.disabled = rows.length <= 1;
  });
}

function addScheduleRow(initial = { weekday: 1, startTime: '14:00', endTime: '16:00' }) {
  const row = document.createElement('div');
  row.dataset.scheduleRow = '1';
  row.className = 'form-row';
  row.style.gridTemplateColumns = '1.4fr 1fr 1fr auto';
  row.style.alignItems = 'start';

  const optionsHtml = WEEKDAY_OPTIONS.map(
    (opt) =>
      `<option value="${opt.value}" ${Number(initial.weekday) === opt.value ? 'selected' : ''}>${opt.label}</option>`,
  ).join('');

  row.innerHTML = `
    <div class="field">
      <select data-field="weekday" aria-label="Dia da semana">${optionsHtml}</select>
    </div>
    <div class="field">
      <input data-field="startTime" type="time" value="${escapeHtml(initial.startTime ?? '')}" aria-label="Horário de início" />
    </div>
    <div class="field">
      <input data-field="endTime" type="time" value="${escapeHtml(initial.endTime ?? '')}" aria-label="Horário de término" />
    </div>
    <div>
      <button type="button" class="btn btn-secondary btn-small" data-remove-schedule title="Remover horário">
        Remover
      </button>
    </div>
  `;

  schedulesListEl.append(row);
  reindexScheduleRows();
}

function setScheduleRows(schedules) {
  schedulesListEl.innerHTML = '';
  const items = Array.isArray(schedules) && schedules.length > 0
    ? schedules
    : [{ weekday: 1, startTime: '14:00', endTime: '16:00' }];
  items.forEach((s) => addScheduleRow(s));
}

function collectSchedules() {
  const rows = [...schedulesListEl.querySelectorAll('[data-schedule-row]')];
  return rows.map((row) => ({
    weekday: Number(row.querySelector('[data-field="weekday"]').value),
    startTime: row.querySelector('[data-field="startTime"]').value,
    endTime: row.querySelector('[data-field="endTime"]').value,
  }));
}

function resetActivityForm() {
  activityForm.reset();
  activityForm.elements.id.value = '';
  clearFieldErrors(activityForm);
  setScheduleRows([]);
  activityFormTitleEl.textContent = 'Nova atividade';
  activitySubmitBtn.textContent = 'Salvar rascunho';
  activityCancelEditBtn.classList.add('hidden');
}

function startEditActivity(activity) {
  clearFieldErrors(activityForm);
  showAlert(activitiesAlertEl, '');

  activityForm.elements.id.value = String(activity.id);
  activityForm.elements.title.value = activity.title ?? '';
  activityForm.elements.type.value = activity.type ?? 'workshop';
  activityForm.elements.categoryId.value = String(activity.categoryId ?? '');
  activityForm.elements.instructorId.value = activity.instructorId ? String(activity.instructorId) : '';
  activityForm.elements.location.value = activity.location ?? '';
  activityForm.elements.startDate.value = activity.startDate ?? '';
  activityForm.elements.endDate.value = activity.endDate ?? '';
  activityForm.elements.capacity.value = String(activity.capacity ?? '');
  activityForm.elements.minAge.value =
    activity.minAge !== null && activity.minAge !== undefined ? String(activity.minAge) : '';
  activityForm.elements.description.value = activity.description ?? '';

  setScheduleRows(activity.schedules);

  activityFormTitleEl.textContent = `Editar atividade: ${activity.title}`;
  activitySubmitBtn.textContent = 'Atualizar atividade';
  activityCancelEditBtn.classList.remove('hidden');
  activityForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function populateSelects() {
  const currentCat = categorySelect.value;
  categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
  for (const cat of categoriesCache) {
    const opt = document.createElement('option');
    opt.value = String(cat.id);
    opt.textContent = cat.name;
    categorySelect.append(opt);
  }
  if (currentCat) categorySelect.value = currentCat;

  const currentInst = instructorSelect.value;
  instructorSelect.innerHTML = '<option value="">Sem instrutor definido</option>';
  for (const inst of instructorsCache) {
    const opt = document.createElement('option');
    opt.value = String(inst.id);
    opt.textContent = inst.active ? inst.name : `${inst.name} (inativo)`;
    instructorSelect.append(opt);
  }
  if (currentInst) instructorSelect.value = currentInst;
}

function renderCategoriesBlock() {
  if (categoriesCache.length === 0) {
    categoriesListEl.innerHTML = '<span class="muted">Nenhuma categoria cadastrada.</span>';
    return;
  }

  categoriesListEl.innerHTML = categoriesCache
    .map(
      (cat) => `
        <span class="badge" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px;">
          <span>${escapeHtml(cat.name)}</span>
          <button
            type="button"
            class="link"
            style="font-size: 0.8rem; text-decoration: underline;"
            data-edit-category="${cat.id}"
          >
            editar
          </button>
        </span>
      `,
    )
    .join('');
}

function renderActivitiesTable() {
  if (activitiesCache.length === 0) {
    activitiesTableWrap.classList.add('hidden');
    activitiesEmptyEl.classList.remove('hidden');
    activitiesTbody.innerHTML = '';
    return;
  }

  activitiesTableWrap.classList.remove('hidden');
  activitiesEmptyEl.classList.add('hidden');

  activitiesTbody.innerHTML = activitiesCache
    .map((act) => {
      const actions = [
        `<button type="button" class="btn btn-secondary btn-small" data-action="edit" data-id="${act.id}">Editar</button>`,
      ];

      if (act.status === 'draft') {
        actions.push(
          `<button type="button" class="btn btn-small" data-action="publish" data-id="${act.id}">Publicar</button>`,
        );
      }

      if (act.status !== 'cancelled') {
        actions.push(
          `<button type="button" class="btn btn-danger btn-small" data-action="cancel" data-id="${act.id}">Cancelar</button>`,
        );
      }

      const instructorText = act.instructor?.name ? ` • ${escapeHtml(act.instructor.name)}` : '';

      return `
        <tr>
          <td>
            <strong>${escapeHtml(act.title)}</strong>
            <div class="muted" style="font-size: 0.85rem;">
              ${escapeHtml(formatActivityType(act.type))} • ${escapeHtml(act.category?.name ?? '')}${instructorText}
            </div>
          </td>
          <td>
            <div>${escapeHtml(formatDateRange(act.startDate, act.endDate))}</div>
            <div class="muted" style="font-size: 0.85rem;">${escapeHtml(formatSchedules(act.schedules))}</div>
          </td>
          <td>${escapeHtml(act.seatsAvailable)} / ${escapeHtml(act.capacity)}</td>
          <td>${STATUS_BADGES[act.status] ?? escapeHtml(act.status)}</td>
          <td>
            <div class="row-actions">${actions.join('')}</div>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function loadAll() {
  try {
    const [categories, instructors, activities] = await Promise.all([
      api('/api/admin/categories'),
      api('/api/admin/instructors'),
      api('/api/admin/activities'),
    ]);
    categoriesCache = categories ?? [];
    instructorsCache = instructors ?? [];
    activitiesCache = activities ?? [];

    populateSelects();
    renderCategoriesBlock();
    renderActivitiesTable();
  } catch (err) {
    showAlert(activitiesAlertEl, err.message);
  }
}

addScheduleBtn?.addEventListener('click', () => addScheduleRow());

schedulesListEl?.addEventListener('click', (event) => {
  const removeBtn = event.target.closest('[data-remove-schedule]');
  if (!removeBtn) return;
  const row = removeBtn.closest('[data-schedule-row]');
  if (row && schedulesListEl.querySelectorAll('[data-schedule-row]').length > 1) {
    row.remove();
    reindexScheduleRows();
  }
});

activityForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(activityForm);
  showAlert(activitiesAlertEl, '');

  const id = activityForm.elements.id.value.trim();
  const minAgeRaw = activityForm.elements.minAge.value.trim();

  const body = {
    title: activityForm.elements.title.value,
    type: activityForm.elements.type.value,
    categoryId: activityForm.elements.categoryId.value,
    instructorId: activityForm.elements.instructorId.value || null,
    location: activityForm.elements.location.value,
    startDate: activityForm.elements.startDate.value,
    endDate: activityForm.elements.endDate.value,
    capacity: activityForm.elements.capacity.value,
    minAge: minAgeRaw === '' ? null : minAgeRaw,
    description: activityForm.elements.description.value,
    schedules: collectSchedules(),
  };

  activitySubmitBtn.disabled = true;
  try {
    if (id) {
      await api(`/api/admin/activities/${encodeURIComponent(id)}`, { method: 'PUT', body });
      showAlert(activitiesAlertEl, 'Atividade atualizada com sucesso.', 'success');
    } else {
      await api('/api/admin/activities', { method: 'POST', body });
      showAlert(activitiesAlertEl, 'Atividade salva como rascunho.', 'success');
    }
    resetActivityForm();
    await loadAll();
  } catch (err) {
    handleFormError(activityForm, activitiesAlertEl, err);
  } finally {
    activitySubmitBtn.disabled = false;
  }
});

activityCancelEditBtn?.addEventListener('click', () => {
  resetActivityForm();
  showAlert(activitiesAlertEl, '');
});

activitiesTbody?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const activity = activitiesCache.find((item) => item.id === id);
  if (!activity) return;

  if (button.dataset.action === 'edit') {
    startEditActivity(activity);
    return;
  }

  if (button.dataset.action === 'publish') {
    button.disabled = true;
    showAlert(activitiesAlertEl, '');
    try {
      await api(`/api/admin/activities/${id}/status`, {
        method: 'POST',
        body: { status: 'published' },
      });
      showAlert(activitiesAlertEl, 'Atividade publicada no catálogo.', 'success');
      await loadAll();
    } catch (err) {
      showAlert(activitiesAlertEl, err.message);
    } finally {
      button.disabled = false;
    }
    return;
  }

  if (button.dataset.action === 'cancel') {
    const confirmed = window.confirm(
      `Cancelar a atividade "${activity.title}"? Ela sairá do catálogo público.`,
    );
    if (!confirmed) return;

    button.disabled = true;
    showAlert(activitiesAlertEl, '');
    try {
      await api(`/api/admin/activities/${id}/status`, {
        method: 'POST',
        body: { status: 'cancelled' },
      });
      showAlert(activitiesAlertEl, 'Atividade cancelada.', 'success');
      await loadAll();
    } catch (err) {
      showAlert(activitiesAlertEl, err.message);
    } finally {
      button.disabled = false;
    }
  }
});

// Categories management
function resetCategoryForm() {
  categoryForm.reset();
  categoryForm.elements.id.value = '';
  clearFieldErrors(categoryForm);
  categorySubmitBtn.textContent = 'Adicionar';
  categoryCancelEditBtn.classList.add('hidden');
}

categoryForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(categoryForm);
  showAlert(categoriesAlertEl, '');

  const id = categoryForm.elements.id.value.trim();
  const body = { name: categoryForm.elements.name.value };

  categorySubmitBtn.disabled = true;
  try {
    if (id) {
      await api(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'PUT', body });
      showAlert(categoriesAlertEl, 'Categoria atualizada.', 'success');
    } else {
      await api('/api/admin/categories', { method: 'POST', body });
      showAlert(categoriesAlertEl, 'Categoria criada.', 'success');
    }
    resetCategoryForm();
    await loadAll();
  } catch (err) {
    handleFormError(categoryForm, categoriesAlertEl, err);
  } finally {
    categorySubmitBtn.disabled = false;
  }
});

categoriesListEl?.addEventListener('click', (event) => {
  const editBtn = event.target.closest('button[data-edit-category]');
  if (!editBtn) return;

  const id = Number(editBtn.dataset.editCategory);
  const category = categoriesCache.find((c) => c.id === id);
  if (!category) return;

  clearFieldErrors(categoryForm);
  showAlert(categoriesAlertEl, '');
  categoryForm.elements.id.value = String(category.id);
  categoryForm.elements.name.value = category.name;
  categorySubmitBtn.textContent = 'Salvar';
  categoryCancelEditBtn.classList.remove('hidden');
  categoryForm.elements.name.focus();
});

categoryCancelEditBtn?.addEventListener('click', () => {
  resetCategoryForm();
  showAlert(categoriesAlertEl, '');
});

setScheduleRows([]);
await loadAll();