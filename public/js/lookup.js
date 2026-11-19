import { api, escapeHtml, showAlert } from './api.js';
import {
  formatActivityType,
  formatDateRange,
  formatSchedules,
} from './format.js';

const form = document.querySelector('#lookup-form');
const alertEl = document.querySelector('#lookup-alert');
const submitBtn = document.querySelector('#lookup-submit');
const resultEl = document.querySelector('#lookup-result');

const STATUS_DISPLAY = {
  pending: {
    badge: '<span class="badge badge-warning">Pendente de confirmação</span>',
    note: 'Sua pré-inscrição foi recebida e aguarda confirmação da equipe do Núcleo.',
  },
  confirmed: {
    badge: '<span class="badge badge-success">Confirmada</span>',
    note: 'Sua vaga está confirmada! Compareça no local e horário indicados.',
  },
  cancelled: {
    badge: '<span class="badge badge-danger">Cancelada</span>',
    note: 'Esta inscrição foi cancelada. Caso deseje participar, realize uma nova pré-inscrição se houver vagas.',
  },
};

async function runLookup(protocol, phone) {
  showAlert(alertEl, '');
  resultEl.classList.add('hidden');

  const params = new URLSearchParams({
    protocol: String(protocol ?? '').trim().toUpperCase(),
    phone: String(phone ?? '').trim(),
  });

  submitBtn.disabled = true;
  try {
    const data = await api(`/api/enrollments/lookup?${params.toString()}`);
    if (!data) return;

    const statusInfo = STATUS_DISPLAY[data.status] ?? {
      badge: `<span class="badge">${escapeHtml(data.status)}</span>`,
      note: '',
    };

    const act = data.activity ?? {};

    resultEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
        <h2 style="margin: 0;">Protocolo ${escapeHtml(data.protocol)}</h2>
        ${statusInfo.badge}
      </div>
      <p class="muted">${escapeHtml(statusInfo.note)}</p>

      <ul class="meta" style="list-style: none; padding: 0; margin: 16px 0; display: grid; gap: 6px;">
        <li><strong>Participante:</strong> ${escapeHtml(data.participantName)}</li>
        <li><strong>Atividade:</strong> ${escapeHtml(act.title)} (${escapeHtml(formatActivityType(act.type))})</li>
        ${act.category?.name ? `<li><strong>Categoria:</strong> ${escapeHtml(act.category.name)}</li>` : ''}
        <li><strong>Período:</strong> ${escapeHtml(formatDateRange(act.startDate, act.endDate))}</li>
        <li><strong>Horário:</strong> ${escapeHtml(formatSchedules(act.schedules))}</li>
        ${act.location ? `<li><strong>Local:</strong> ${escapeHtml(act.location)}</li>` : ''}
      </ul>

      <div>
        <a class="btn btn-secondary" href="/atividade.html?id=${encodeURIComponent(act.id)}">
          Ver página da atividade
        </a>
      </div>
    `;
    resultEl.classList.remove('hidden');
  } catch (err) {
    showAlert(alertEl, err.message);
  } finally {
    submitBtn.disabled = false;
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  runLookup(form.elements.protocol.value, form.elements.phone.value);
});

const urlParams = new URLSearchParams(window.location.search);
const initialProtocol = urlParams.get('protocol');
const initialPhone = urlParams.get('phone');

if (initialProtocol) form.elements.protocol.value = initialProtocol;
if (initialPhone) form.elements.phone.value = initialPhone;

if (initialProtocol && initialPhone) {
  runLookup(initialProtocol, initialPhone);
}