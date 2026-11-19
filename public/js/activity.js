import { api, escapeHtml, showAlert } from './api.js';
import {
  formatActivityType,
  formatDateRange,
  formatSchedules,
  formatSeats,
} from './format.js';

const alertEl = document.querySelector('#activity-alert');
const detailEl = document.querySelector('#activity-detail');
const enrollSectionEl = document.querySelector('#enroll-section');
const enrollPlaceholderEl = document.querySelector('#enroll-placeholder');

const WEEKDAYS_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

async function initActivityPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    showAlert(alertEl, 'Atividade não informada.');
    return;
  }

  try {
    const activity = await api(`/api/activities/${encodeURIComponent(id)}`);
    if (!activity) {
      showAlert(alertEl, 'Atividade não encontrada.');
      return;
    }

    document.title = `${activity.title} — Núcleo Marcus Jussier`;

    const badges = [
      `<span class="badge badge-primary">${escapeHtml(activity.category?.name ?? '')}</span>`,
      `<span class="badge">${escapeHtml(formatActivityType(activity.type))}</span>`,
      activity.soldOut
        ? '<span class="badge badge-danger">Esgotado</span>'
        : '<span class="badge badge-success">Vagas abertas</span>',
    ];

    const schedulesList = (activity.schedules ?? [])
      .map(
        (s) =>
          `<li>${escapeHtml(WEEKDAYS_FULL[s.weekday] ?? '')}, das ${escapeHtml(s.startTime)} às ${escapeHtml(s.endTime)}</li>`,
      )
      .join('');

    const instructorBlock = activity.instructor
      ? `
        <h2>Instrutor(a)</h2>
        <p><strong>${escapeHtml(activity.instructor.name)}</strong></p>
        ${activity.instructor.bio ? `<p class="muted">${escapeHtml(activity.instructor.bio)}</p>` : ''}
      `
      : '';

    detailEl.innerHTML = `
      <div style="margin-bottom: 8px;">${badges.join(' ')}</div>
      <h1>${escapeHtml(activity.title)}</h1>
      ${activity.description ? `<p>${escapeHtml(activity.description)}</p>` : ''}

      <ul class="meta" style="list-style: none; padding: 0; margin: 16px 0; display: grid; gap: 6px;">
        <li><strong>Período:</strong> ${escapeHtml(formatDateRange(activity.startDate, activity.endDate))}</li>
        <li><strong>Resumo de horários:</strong> ${escapeHtml(formatSchedules(activity.schedules))}</li>
        ${activity.location ? `<li><strong>Local:</strong> ${escapeHtml(activity.location)}</li>` : ''}
        ${
          activity.minAge !== null && activity.minAge !== undefined
            ? `<li><strong>Idade mínima:</strong> ${escapeHtml(activity.minAge)} anos</li>`
            : ''
        }
        <li><strong>Vagas:</strong> ${escapeHtml(formatSeats(activity.seatsAvailable, activity.capacity))}</li>
      </ul>

      ${
        schedulesList
          ? `<h2>Encontros semanais</h2><ul>${schedulesList}</ul>`
          : ''
      }

      ${instructorBlock}
    `;

    detailEl.classList.remove('hidden');

    if (enrollSectionEl) {
      enrollSectionEl.classList.remove('hidden');
      if (activity.soldOut && enrollPlaceholderEl) {
        enrollPlaceholderEl.textContent = 'As vagas para esta atividade estão esgotadas.';
      }
    }
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

initActivityPage();