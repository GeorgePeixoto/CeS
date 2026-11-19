import { api, escapeHtml, showAlert } from './api.js';

const alertEl = document.querySelector('#reports-alert');
const filterForm = document.querySelector('#reports-filter-form');
const fromInput = document.querySelector('#filter-from');
const toInput = document.querySelector('#filter-to');
const categorySelect = document.querySelector('#filter-category');
const clearBtn = document.querySelector('#filter-clear');

const totalActivitiesEl = document.querySelector('#total-activities');
const totalEnrollmentsEl = document.querySelector('#total-enrollments');
const totalParticipantsEl = document.querySelector('#total-participants');
const totalOccupancyEl = document.querySelector('#total-occupancy');
const totalAttendanceEl = document.querySelector('#total-attendance');

const chartsSectionEl = document.querySelector('#charts-section');
const occupancyCanvas = document.querySelector('#chart-occupancy');
const attendanceCanvas = document.querySelector('#chart-attendance');

const tableWrap = document.querySelector('#reports-table-wrap');
const tbody = document.querySelector('#reports-tbody');
const emptyEl = document.querySelector('#reports-empty');
const sortButtons = [...document.querySelectorAll('button[data-sort]')];

let currentRows = [];
let sortState = { key: 'title', dir: 'asc' };
let occupancyChart = null;
let attendanceChart = null;

async function loadCategories() {
  try {
    const categories = (await api('/api/admin/categories')) ?? [];
    for (const cat of categories) {
      const opt = document.createElement('option');
      opt.value = String(cat.id);
      opt.textContent = cat.name;
      categorySelect.append(opt);
    }
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

function renderTotals(totals) {
  totalActivitiesEl.textContent = String(totals?.activities ?? 0);
  totalEnrollmentsEl.textContent = String(totals?.enrollments ?? 0);
  totalParticipantsEl.textContent = String(totals?.participants ?? 0);
  totalOccupancyEl.textContent = `${totals?.avgOccupancy ?? 0}%`;
  totalAttendanceEl.textContent =
    totals?.avgAttendance === null || totals?.avgAttendance === undefined
      ? '—'
      : `${totals.avgAttendance}%`;
}

function compareValues(aVal, bVal, dir) {
  const factor = dir === 'asc' ? 1 : -1;

  if (aVal === null || aVal === undefined) return 1;
  if (bVal === null || bVal === undefined) return -1;

  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return (aVal - bVal) * factor;
  }

  return String(aVal).localeCompare(String(bVal), 'pt-BR', { sensitivity: 'base' }) * factor;
}

function updateSortIndicators() {
  for (const btn of sortButtons) {
    const baseLabel = btn.dataset.label || btn.textContent.replace(/\s*[▲▼]$/, '');
    btn.dataset.label = baseLabel;
    if (btn.dataset.sort === sortState.key) {
      btn.textContent = `${baseLabel} ${sortState.dir === 'asc' ? '▲' : '▼'}`;
    } else {
      btn.textContent = baseLabel;
    }
  }
}

function renderTable() {
  updateSortIndicators();

  if (currentRows.length === 0) {
    tableWrap.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    tbody.innerHTML = '';
    return;
  }

  tableWrap.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  const sorted = [...currentRows].sort((a, b) =>
    compareValues(a[sortState.key], b[sortState.key], sortState.dir),
  );

  tbody.innerHTML = sorted
    .map((row) => {
      const attendanceText =
        row.attendanceRate === null || row.attendanceRate === undefined
          ? '—'
          : `${row.attendanceRate}%`;

      return `
        <tr>
          <td><strong>${escapeHtml(row.title)}</strong></td>
          <td>${escapeHtml(row.category)}</td>
          <td class="num">${escapeHtml(row.capacity)}</td>
          <td class="num">${escapeHtml(row.enrolled)}</td>
          <td class="num">${escapeHtml(row.confirmed)}</td>
          <td class="num">${escapeHtml(row.occupancy)}%</td>
          <td class="num">${escapeHtml(attendanceText)}</td>
        </tr>
      `;
    })
    .join('');
}

function shortenLabel(text, max = 22) {
  const str = String(text ?? '');
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function renderCharts(rows) {
  const ChartLib = window.Chart;
  if (!ChartLib || !occupancyCanvas || !attendanceCanvas) {
    return;
  }

  if (occupancyChart) {
    occupancyChart.destroy();
    occupancyChart = null;
  }
  if (attendanceChart) {
    attendanceChart.destroy();
    attendanceChart = null;
  }

  if (rows.length === 0) {
    chartsSectionEl?.classList.add('hidden');
    return;
  }

  chartsSectionEl?.classList.remove('hidden');

  const labels = rows.map((r) => shortenLabel(r.title));

  occupancyChart = new ChartLib(occupancyCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Inscritos ativos',
          data: rows.map((r) => r.enrolled),
          backgroundColor: '#1f5c4d',
        },
        {
          label: 'Vagas',
          data: rows.map((r) => r.capacity),
          backgroundColor: '#c9d6d1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
    },
  });

  attendanceChart = new ChartLib(attendanceCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Frequência (%)',
          data: rows.map((r) => (r.attendanceRate === null ? 0 : r.attendanceRate)),
          backgroundColor: rows.map((r) =>
            r.attendanceRate === null ? '#e2e8f0' : '#2b6cb0',
          ),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label(ctx) {
              const row = rows[ctx.dataIndex];
              if (!row || row.attendanceRate === null) {
                return 'Frequência: sem chamada registrada (—)';
              }
              return `Frequência: ${row.attendanceRate}%`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback(value) {
              return `${value}%`;
            },
          },
        },
      },
    },
  });
}

async function loadSummary() {
  showAlert(alertEl, '');

  const params = new URLSearchParams();
  if (fromInput.value) params.set('from', fromInput.value);
  if (toInput.value) params.set('to', toInput.value);
  if (categorySelect.value) params.set('category', categorySelect.value);

  const query = params.toString();
  const url = query ? `/api/admin/reports/summary?${query}` : '/api/admin/reports/summary';

  try {
    const summary = await api(url);
    if (!summary) return;

    renderTotals(summary.totals);
    currentRows = summary.byActivity ?? [];
    renderTable();
    renderCharts(currentRows);
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

filterForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  loadSummary();
});

categorySelect?.addEventListener('change', loadSummary);

clearBtn?.addEventListener('click', () => {
  filterForm.reset();
  loadSummary();
});

for (const btn of sortButtons) {
  btn.addEventListener('click', () => {
    const key = btn.dataset.sort;
    if (sortState.key === key) {
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState = { key, dir: key === 'title' || key === 'category' ? 'asc' : 'desc' };
    }
    renderTable();
  });
}

await loadCategories();
await loadSummary();