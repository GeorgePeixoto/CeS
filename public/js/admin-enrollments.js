import {
  api,
  clearFieldErrors,
  escapeHtml,
  handleFormError,
  showAlert,
} from './api.js';
import { formatDateRange } from './format.js';

const alertEl = document.querySelector('#enrollments-alert');
const filterForm = document.querySelector('#enrollments-filter-form');
const activityFilterEl = document.querySelector('#filter-activity');
const statusFilterEl = document.querySelector('#filter-status');
const qFilterEl = document.querySelector('#filter-q');
const clearFilterBtn = document.querySelector('#filter-clear');
const countEl = document.querySelector('#enrollments-count');
const tableWrap = document.querySelector('#enrollments-table-wrap');
const tbody = document.querySelector('#enrollments-tbody');
const emptyEl = document.querySelector('#enrollments-empty');

const walkinPanel = document.querySelector('#walkin-panel');
const walkinForm = document.querySelector('#walkin-form');
const walkinActivitySelect = document.querySelector('#walkin-activity');
const walkinBirthDateInput = document.querySelector('#walkin-birth-date');
const walkinGuardianFields = document.querySelector('#walkin-guardian-fields');
const walkinSubmitBtn = document.querySelector('#walkin-submit');

const STATUS_BADGES = {
  pending: '<span class="badge badge-warning">Pendente</span>',
  confirmed: '<span class="badge badge-success">Confirmada</span>',
  cancelled: '<span class="badge badge-danger">Cancelada</span>',
};

const fortalezaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Fortaleza',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

let enrollmentsCache = [];
let debounceTimer = null;

function formatPhone(digits) {
  const clean = String(digits ?? '').replace(/\D/g, '');
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return digits ?? '';
}

function calculateAgeInFortaleza(birthDateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) return null;
  const todayStr = fortalezaFormatter.format(new Date());
  const [by, bm, bd] = birthDateStr.split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

function updateWalkinGuardianVisibility() {
  const age = calculateAgeInFortaleza(walkinBirthDateInput?.value ?? '');
  const isMinor = age !== null && age >= 0 && age < 18;
  walkinGuardianFields?.classList.toggle('hidden', !isMinor);
}

async function loadActivitiesOptions() {
  try {
    const activities = (await api('/api/admin/activities')) ?? [];
    for (const act of activities) {
      const filterOpt = document.createElement('option');
      filterOpt.value = String(act.id);
      filterOpt.textContent = act.title;
      activityFilterEl.append(filterOpt);

      if (act.status === 'published') {
        const walkinOpt = document.createElement('option');
        walkinOpt.value = String(act.id);
        walkinOpt.textContent = `${act.title} (${act.seatsAvailable} vagas)`;
        walkinActivitySelect.append(walkinOpt);
      }
    }
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

function renderEnrollments() {
  if (enrollmentsCache.length === 0) {
    tableWrap.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    countEl.textContent = '';
    tbody.innerHTML = '';
    return;
  }

  tableWrap.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  countEl.textContent =
    enrollmentsCache.length === 1
      ? '1 inscrição encontrada'
      : `${enrollmentsCache.length} inscrições encontradas`;

  tbody.innerHTML = enrollmentsCache
    .map((item) => {
      const p = item.participant ?? {};
      const act = item.activity ?? {};

      const guardianInfo = p.guardianName
        ? `<div class="muted" style="font-size: 0.85rem;">Resp.: ${escapeHtml(p.guardianName)} (${escapeHtml(formatPhone(p.guardianPhone))})</div>`
        : '';

      const actions = [];
      if (item.status === 'pending') {
        actions.push(
          `<button type="button" class="btn btn-small" data-action="confirm" data-id="${item.id}">Confirmar</button>`,
        );
      }
      if (item.status !== 'cancelled') {
        actions.push(
          `<button type="button" class="btn btn-danger btn-small" data-action="cancel" data-id="${item.id}">Cancelar</button>`,
        );
      }

      return `
        <tr>
          <td><strong>${escapeHtml(item.protocol)}</strong></td>
          <td>
            <div><strong>${escapeHtml(p.name)}</strong> (${escapeHtml(p.age)} anos)</div>
            <div class="muted" style="font-size: 0.85rem;">${escapeHtml(formatPhone(p.phone))}</div>
            ${guardianInfo}
          </td>
          <td>
            <div>${escapeHtml(act.title)}</div>
            <div class="muted" style="font-size: 0.85rem;">${escapeHtml(formatDateRange(act.startDate, act.endDate))}</div>
          </td>
          <td>${STATUS_BADGES[item.status] ?? escapeHtml(item.status)}</td>
          <td>
            <div class="row-actions">
              ${actions.length > 0 ? actions.join('') : '<span class="muted">—</span>'}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function loadEnrollments() {
  const params = new URLSearchParams();
  if (activityFilterEl.value) params.set('activity', activityFilterEl.value);
  if (statusFilterEl.value) params.set('status', statusFilterEl.value);
  const q = qFilterEl.value.trim();
  if (q) params.set('q', q);

  const query = params.toString();
  const url = query ? `/api/admin/enrollments?${query}` : '/api/admin/enrollments';

  try {
    enrollmentsCache = (await api(url)) ?? [];
    renderEnrollments();
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

filterForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(debounceTimer);
  loadEnrollments();
});

activityFilterEl?.addEventListener('change', loadEnrollments);
statusFilterEl?.addEventListener('change', loadEnrollments);
qFilterEl?.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadEnrollments, 250);
});

clearFilterBtn?.addEventListener('click', () => {
  filterForm.reset();
  loadEnrollments();
});

tbody?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const enrollment = enrollmentsCache.find((e) => e.id === id);
  if (!enrollment) return;

  const action = button.dataset.action;

  if (action === 'cancel') {
    const confirmed = window.confirm(
      `Cancelar a inscrição ${enrollment.protocol} de "${enrollment.participant?.name}"? A vaga será liberada imediatamente no catálogo.`,
    );
    if (!confirmed) return;
  }

  const nextStatus = action === 'confirm' ? 'confirmed' : 'cancelled';

  button.disabled = true;
  showAlert(alertEl, '');
  try {
    await api(`/api/admin/enrollments/${id}/status`, {
      method: 'POST',
      body: { status: nextStatus },
    });
    showAlert(
      alertEl,
      nextStatus === 'confirmed'
        ? `Inscrição ${enrollment.protocol} confirmada.`
        : `Inscrição ${enrollment.protocol} cancelada e vaga liberada.`,
      'success',
    );
    await loadEnrollments();
  } catch (err) {
    showAlert(alertEl, err.message);
  } finally {
    button.disabled = false;
  }
});

walkinBirthDateInput?.addEventListener('change', updateWalkinGuardianVisibility);
walkinBirthDateInput?.addEventListener('input', updateWalkinGuardianVisibility);

walkinForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(walkinForm);
  showAlert(alertEl, '');

  const activityId = walkinForm.elements.activityId.value;
  if (!activityId) {
    showAlert(alertEl, 'Selecione uma atividade para registrar a inscrição presencial.');
    return;
  }

  const age = calculateAgeInFortaleza(walkinForm.elements.birthDate.value);
  const isMinor = age !== null && age >= 0 && age < 18;

  const body = {
    name: walkinForm.elements.name.value,
    phone: walkinForm.elements.phone.value,
    email: walkinForm.elements.email.value,
    birthDate: walkinForm.elements.birthDate.value,
    guardianName: isMinor ? walkinForm.elements.guardianName.value : null,
    guardianPhone: isMinor ? walkinForm.elements.guardianPhone.value : null,
  };

  walkinSubmitBtn.disabled = true;
  try {
    const created = await api(`/api/admin/activities/${encodeURIComponent(activityId)}/enrollments`, {
      method: 'POST',
      body,
    });
    walkinForm.reset();
    updateWalkinGuardianVisibility();
    if (walkinPanel) walkinPanel.open = false;
    showAlert(
      alertEl,
      `Inscrição presencial confirmada! Protocolo: ${created.protocol}.`,
      'success',
    );
    await loadEnrollments();
  } catch (err) {
    handleFormError(walkinForm, alertEl, err);
  } finally {
    walkinSubmitBtn.disabled = false;
  }
});

await loadActivitiesOptions();
await loadEnrollments();