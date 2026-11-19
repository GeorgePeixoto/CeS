import { api, escapeHtml, showAlert } from './api.js';
import {
  formatActivityType,
  formatDateRange,
  formatSchedules,
  formatSeats,
} from './format.js';

const alertEl = document.querySelector('#catalog-alert');
const filterForm = document.querySelector('#filter-form');
const qInput = document.querySelector('#filter-q');
const categorySelect = document.querySelector('#filter-category');
const typeSelect = document.querySelector('#filter-type');
const clearBtn = document.querySelector('#clear-filters');
const countEl = document.querySelector('#results-count');
const gridEl = document.querySelector('#activities-grid');
const emptyEl = document.querySelector('#empty-state');

let debounceTimer = null;

async function loadCategories() {
  try {
    const categories = await api('/api/categories');
    for (const cat of categories ?? []) {
      const option = document.createElement('option');
      option.value = String(cat.id);
      option.textContent = cat.name;
      categorySelect.append(option);
    }
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

function renderCard(activity) {
  const badges = [
    `<span class="badge badge-primary">${escapeHtml(activity.category?.name ?? '')}</span>`,
    `<span class="badge">${escapeHtml(formatActivityType(activity.type))}</span>`,
  ];

  if (activity.soldOut) {
    badges.push('<span class="badge badge-danger">Esgotado</span>');
  } else {
    badges.push('<span class="badge badge-success">Vagas abertas</span>');
  }

  const instructorLine = activity.instructor?.name
    ? `<li><strong>Instrutor(a):</strong> ${escapeHtml(activity.instructor.name)}</li>`
    : '';

  const locationLine = activity.location
    ? `<li><strong>Local:</strong> ${escapeHtml(activity.location)}</li>`
    : '';

  const minAgeLine =
    activity.minAge !== null && activity.minAge !== undefined
      ? `<li><strong>Idade mínima:</strong> ${escapeHtml(activity.minAge)} anos</li>`
      : '';

  return `
    <article class="card">
      <div>${badges.join(' ')}</div>
      <h3>${escapeHtml(activity.title)}</h3>
      <ul class="meta">
        <li><strong>Data:</strong> ${escapeHtml(formatDateRange(activity.startDate, activity.endDate))}</li>
        <li><strong>Horário:</strong> ${escapeHtml(formatSchedules(activity.schedules))}</li>
        ${instructorLine}
        ${locationLine}
        ${minAgeLine}
        <li><strong>Vagas:</strong> ${escapeHtml(formatSeats(activity.seatsAvailable, activity.capacity))}</li>
      </ul>
      <div class="actions">
        <a class="btn ${activity.soldOut ? 'btn-secondary' : ''}" href="/atividade.html?id=${encodeURIComponent(activity.id)}">
          ${activity.soldOut ? 'Ver detalhes' : 'Ver detalhes e inscrever-se'}
        </a>
      </div>
    </article>
  `;
}

async function loadActivities() {
  showAlert(alertEl, '');

  const params = new URLSearchParams();
  const q = qInput.value.trim();
  const category = categorySelect.value;
  const type = typeSelect.value;

  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (type) params.set('type', type);

  const queryString = params.toString();
  const url = queryString ? `/api/activities?${queryString}` : '/api/activities';

  try {
    const activities = (await api(url)) ?? [];

    if (activities.length === 0) {
      gridEl.innerHTML = '';
      countEl.textContent = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    countEl.textContent =
      activities.length === 1
        ? '1 atividade encontrada'
        : `${activities.length} atividades encontradas`;
    gridEl.innerHTML = activities.map(renderCard).join('');
  } catch (err) {
    gridEl.innerHTML = '';
    countEl.textContent = '';
    showAlert(alertEl, err.message);
  }
}

filterForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(debounceTimer);
  loadActivities();
});

qInput?.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadActivities, 250);
});

categorySelect?.addEventListener('change', loadActivities);
typeSelect?.addEventListener('change', loadActivities);

clearBtn?.addEventListener('click', () => {
  filterForm.reset();
  loadActivities();
});

await loadCategories();
await loadActivities();