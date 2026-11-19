import {
  api,
  clearFieldErrors,
  escapeHtml,
  handleFormError,
  showAlert,
} from './api.js';
import { formatActivityType, formatDateRange } from './format.js';

const alertEl = document.querySelector('#participants-alert');
const searchForm = document.querySelector('#participants-search-form');
const searchInput = document.querySelector('#search-q');
const clearSearchBtn = document.querySelector('#search-clear');
const tableWrap = document.querySelector('#participants-table-wrap');
const tbody = document.querySelector('#participants-tbody');
const emptyEl = document.querySelector('#participants-empty');

const detailPanel = document.querySelector('#participant-detail-panel');
const detailTitleEl = document.querySelector('#participant-detail-title');
const closeDetailBtn = document.querySelector('#close-detail-btn');
const editForm = document.querySelector('#participant-edit-form');
const birthDateInput = document.querySelector('#part-birth-date');
const guardianFieldsEl = document.querySelector('#part-guardian-fields');
const saveBtn = document.querySelector('#part-save-btn');
const historyEl = document.querySelector('#participant-history');

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

let participantsCache = [];
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

function updateGuardianVisibility() {
  const age = calculateAgeInFortaleza(birthDateInput?.value ?? '');
  const isMinor = age !== null && age >= 0 && age < 18;
  guardianFieldsEl?.classList.toggle('hidden', !isMinor);
}

function renderParticipantsTable() {
  if (participantsCache.length === 0) {
    tableWrap.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    tbody.innerHTML = '';
    return;
  }

  tableWrap.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  tbody.innerHTML = participantsCache
    .map((p) => {
      const contacts = [formatPhone(p.phone), p.email].filter(Boolean).join(' • ');
      const guardian = p.guardianName
        ? `${escapeHtml(p.guardianName)} (${escapeHtml(formatPhone(p.guardianPhone))})`
        : '<span class="muted">—</span>';

      return `
        <tr>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td>${escapeHtml(p.age)} anos</td>
          <td>${escapeHtml(contacts)}</td>
          <td>${guardian}</td>
          <td class="num">${escapeHtml(p.activeEnrollments ?? 0)} / ${escapeHtml(p.totalEnrollments ?? 0)}</td>
          <td>
            <button type="button" class="btn btn-secondary btn-small" data-open-id="${p.id}">
              Ver / Editar
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function loadParticipants() {
  const q = searchInput.value.trim();
  const url = q ? `/api/admin/participants?q=${encodeURIComponent(q)}` : '/api/admin/participants';

  try {
    participantsCache = (await api(url)) ?? [];
    renderParticipantsTable();
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

async function openParticipantDetail(id) {
  clearFieldErrors(editForm);
  showAlert(alertEl, '');

  try {
    const detail = await api(`/api/admin/participants/${encodeURIComponent(id)}`);
    if (!detail) return;

    detailTitleEl.textContent = `Ficha: ${detail.name} (${detail.age} anos)`;
    editForm.elements.id.value = String(detail.id);
    editForm.elements.name.value = detail.name ?? '';
    editForm.elements.phone.value = detail.phone ?? '';
    editForm.elements.birthDate.value = detail.birthDate ?? '';
    editForm.elements.email.value = detail.email ?? '';
    editForm.elements.guardianName.value = detail.guardianName ?? '';
    editForm.elements.guardianPhone.value = detail.guardianPhone ?? '';
    updateGuardianVisibility();

    const enrollments = detail.enrollments ?? [];
    if (enrollments.length === 0) {
      historyEl.innerHTML = '<p class="muted">Nenhuma inscrição registrada para este participante.</p>';
    } else {
      historyEl.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Atividade</th>
                <th>Período</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              ${enrollments
                .map(
                  (e) => `
                    <tr>
                      <td><strong>${escapeHtml(e.protocol)}</strong></td>
                      <td>${escapeHtml(e.activity?.title)} (${escapeHtml(formatActivityType(e.activity?.type))})</td>
                      <td>${escapeHtml(formatDateRange(e.activity?.startDate, e.activity?.endDate))}</td>
                      <td>${STATUS_BADGES[e.status] ?? escapeHtml(e.status)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    detailPanel.classList.remove('hidden');
    detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

searchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(debounceTimer);
  loadParticipants();
});

searchInput?.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadParticipants, 250);
});

clearSearchBtn?.addEventListener('click', () => {
  searchForm.reset();
  loadParticipants();
});

tbody?.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-open-id]');
  if (!btn) return;
  openParticipantDetail(btn.dataset.openId);
});

closeDetailBtn?.addEventListener('click', () => {
  detailPanel.classList.add('hidden');
});

birthDateInput?.addEventListener('change', updateGuardianVisibility);
birthDateInput?.addEventListener('input', updateGuardianVisibility);

editForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(editForm);
  showAlert(alertEl, '');

  const id = editForm.elements.id.value;
  const age = calculateAgeInFortaleza(editForm.elements.birthDate.value);
  const isMinor = age !== null && age >= 0 && age < 18;

  const body = {
    name: editForm.elements.name.value,
    phone: editForm.elements.phone.value,
    birthDate: editForm.elements.birthDate.value,
    email: editForm.elements.email.value,
    guardianName: isMinor ? editForm.elements.guardianName.value : null,
    guardianPhone: isMinor ? editForm.elements.guardianPhone.value : null,
  };

  saveBtn.disabled = true;
  try {
    await api(`/api/admin/participants/${encodeURIComponent(id)}`, { method: 'PUT', body });
    showAlert(alertEl, 'Dados do participante atualizados com sucesso.', 'success');
    await loadParticipants();
    await openParticipantDetail(id);
  } catch (err) {
    handleFormError(editForm, alertEl, err);
  } finally {
    saveBtn.disabled = false;
  }
});

await loadParticipants();