import { api, escapeHtml, showAlert } from './api.js';
import { formatDateBR } from './format.js';

const alertEl = document.querySelector('#attendance-alert');
const activitySelect = document.querySelector('#attendance-activity');
const dateSelect = document.querySelector('#attendance-date');
const pendingWarningEl = document.querySelector('#pending-warning');
const rosterPanel = document.querySelector('#roster-panel');
const rosterTitleEl = document.querySelector('#roster-title');
const rosterSummaryEl = document.querySelector('#roster-summary');
const checkAllBtn = document.querySelector('#check-all-btn');
const uncheckAllBtn = document.querySelector('#uncheck-all-btn');
const attendanceForm = document.querySelector('#attendance-form');
const tbody = document.querySelector('#attendance-tbody');
const saveBtn = document.querySelector('#save-attendance-btn');
const emptyEl = document.querySelector('#attendance-empty');

const fortalezaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Fortaleza',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

let currentRecords = [];

function todayIsoInFortaleza() {
  return fortalezaFormatter.format(new Date());
}

function formatPhone(digits) {
  const clean = String(digits ?? '').replace(/\D/g, '');
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return digits ?? '';
}

function updateSummary() {
  const checkboxes = [...tbody.querySelectorAll('input[type="checkbox"][data-enrollment-id]')];
  const total = checkboxes.length;
  const present = checkboxes.filter((cb) => cb.checked).length;
  rosterSummaryEl.textContent = `${present} de ${total} ${total === 1 ? 'presente' : 'presentes'}`;
}

function hidePanels() {
  rosterPanel.classList.add('hidden');
  emptyEl.classList.add('hidden');
  pendingWarningEl.classList.add('hidden');
}

async function loadActivities() {
  try {
    const activities = (await api('/api/admin/activities')) ?? [];
    for (const act of activities) {
      if (act.status === 'cancelled') continue;
      const opt = document.createElement('option');
      opt.value = String(act.id);
      opt.textContent = act.title;
      activitySelect.append(opt);
    }
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

async function loadSessionsForActivity(activityId, preferredDate = null) {
  showAlert(alertEl, '');
  hidePanels();
  dateSelect.innerHTML = '';

  if (!activityId) {
    dateSelect.disabled = true;
    dateSelect.innerHTML = '<option value="">Selecione uma atividade primeiro</option>';
    return;
  }

  try {
    const sessions = (await api(`/api/admin/activities/${encodeURIComponent(activityId)}/sessions`)) ?? [];
    const today = todayIsoInFortaleza();
    const pastOrToday = sessions.filter((s) => s.date <= today);

    if (pastOrToday.length === 0) {
      dateSelect.disabled = true;
      dateSelect.innerHTML = '<option value="">Nenhum encontro realizado até hoje</option>';
      emptyEl.textContent = 'Esta atividade ainda não possui encontros realizados até hoje.';
      emptyEl.classList.remove('hidden');
      return;
    }

    dateSelect.disabled = false;
    for (const session of pastOrToday) {
      const opt = document.createElement('option');
      opt.value = session.date;
      opt.textContent = session.recorded
        ? `${formatDateBR(session.date)} (chamada salva)`
        : `${formatDateBR(session.date)} (pendente)`;
      dateSelect.append(opt);
    }

    // Padrão: último encontro até hoje (ou mantém a data selecionada após salvar)
    const defaultDate =
      preferredDate && pastOrToday.some((s) => s.date === preferredDate)
        ? preferredDate
        : pastOrToday[pastOrToday.length - 1].date;

    dateSelect.value = defaultDate;
    await loadAttendance(activityId, defaultDate);
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

async function loadAttendance(activityId, date) {
  showAlert(alertEl, '');
  hidePanels();

  if (!activityId || !date) return;

  try {
    const data = await api(
      `/api/admin/activities/${encodeURIComponent(activityId)}/attendance?date=${encodeURIComponent(date)}`,
    );
    if (!data) return;

    if (data.pendingCount > 0) {
      pendingWarningEl.innerHTML =
        data.pendingCount === 1
          ? 'Há <strong>1 inscrição pendente</strong> de confirmação nesta atividade. <a href="/admin/inscricoes.html">Gerenciar inscrições</a>.'
          : `Há <strong>${data.pendingCount} inscrições pendentes</strong> de confirmação nesta atividade. <a href="/admin/inscricoes.html">Gerenciar inscrições</a>.`;
      pendingWarningEl.classList.remove('hidden');
    }

    currentRecords = data.records ?? [];
    if (currentRecords.length === 0) {
      emptyEl.textContent = 'Nenhum inscrito confirmado para esta atividade.';
      emptyEl.classList.remove('hidden');
      return;
    }

    rosterTitleEl.textContent = `Chamada de ${formatDateBR(date)}`;
    tbody.innerHTML = currentRecords
      .map((item) => {
        const checked = item.present === true ? 'checked' : '';
        return `
          <tr>
            <td>
              <input
                type="checkbox"
                data-enrollment-id="${item.enrollmentId}"
                aria-label="Presença de ${escapeHtml(item.participant?.name)}"
                ${checked}
              />
            </td>
            <td><strong>${escapeHtml(item.participant?.name)}</strong></td>
            <td>${escapeHtml(item.protocol)}</td>
            <td>${escapeHtml(formatPhone(item.participant?.phone))}</td>
          </tr>
        `;
      })
      .join('');

    updateSummary();
    rosterPanel.classList.remove('hidden');
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

activitySelect?.addEventListener('change', () => {
  loadSessionsForActivity(activitySelect.value);
});

dateSelect?.addEventListener('change', () => {
  loadAttendance(activitySelect.value, dateSelect.value);
});

tbody?.addEventListener('change', (event) => {
  if (event.target.matches('input[type="checkbox"][data-enrollment-id]')) {
    updateSummary();
  }
});

checkAllBtn?.addEventListener('click', () => {
  for (const cb of tbody.querySelectorAll('input[type="checkbox"][data-enrollment-id]')) {
    cb.checked = true;
  }
  updateSummary();
});

uncheckAllBtn?.addEventListener('click', () => {
  for (const cb of tbody.querySelectorAll('input[type="checkbox"][data-enrollment-id]')) {
    cb.checked = false;
  }
  updateSummary();
});

attendanceForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  showAlert(alertEl, '');

  const activityId = activitySelect.value;
  const date = dateSelect.value;
  if (!activityId || !date) return;

  const records = [...tbody.querySelectorAll('input[type="checkbox"][data-enrollment-id]')].map(
    (cb) => ({
      enrollmentId: Number(cb.dataset.enrollmentId),
      present: cb.checked,
    }),
  );

  saveBtn.disabled = true;
  try {
    const result = await api(
      `/api/admin/activities/${encodeURIComponent(activityId)}/attendance?date=${encodeURIComponent(date)}`,
      {
        method: 'PUT',
        body: { records },
      },
    );

    showAlert(
      alertEl,
      `Chamada de ${formatDateBR(date)} salva (${result.presentCount} presentes, ${result.absentCount} ausentes).`,
      'success',
    );
    await loadSessionsForActivity(activityId, date);
  } catch (err) {
    showAlert(alertEl, err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

await loadActivities();