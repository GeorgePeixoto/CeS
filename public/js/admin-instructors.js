import {
  api,
  clearFieldErrors,
  escapeHtml,
  handleFormError,
  showAlert,
} from './api.js';

const alertEl = document.querySelector('#instructors-alert');
const form = document.querySelector('#instructor-form');
const formTitleEl = document.querySelector('#instructor-form-title');
const submitBtn = document.querySelector('#instructor-submit');
const cancelEditBtn = document.querySelector('#instructor-cancel-edit');
const tbody = document.querySelector('#instructors-tbody');
const tableWrap = document.querySelector('#instructors-table-wrap');
const emptyEl = document.querySelector('#instructors-empty');

let instructorsCache = [];

function resetForm() {
  form.reset();
  form.elements.id.value = '';
  form.elements.active.checked = true;
  clearFieldErrors(form);
  formTitleEl.textContent = 'Novo instrutor';
  submitBtn.textContent = 'Salvar instrutor';
  cancelEditBtn.classList.add('hidden');
}

function startEdit(instructor) {
  clearFieldErrors(form);
  showAlert(alertEl, '');
  form.elements.id.value = String(instructor.id);
  form.elements.name.value = instructor.name ?? '';
  form.elements.phone.value = instructor.phone ?? '';
  form.elements.email.value = instructor.email ?? '';
  form.elements.bio.value = instructor.bio ?? '';
  form.elements.active.checked = Boolean(instructor.active);

  formTitleEl.textContent = `Editar instrutor: ${instructor.name}`;
  submitBtn.textContent = 'Atualizar instrutor';
  cancelEditBtn.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function formatPhoneDisplay(digits) {
  if (!digits) return '';
  const clean = String(digits).replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return digits;
}

function renderInstructors() {
  if (instructorsCache.length === 0) {
    tableWrap.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    tbody.innerHTML = '';
    return;
  }

  tableWrap.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  tbody.innerHTML = instructorsCache
    .map((inst) => {
      const contacts = [formatPhoneDisplay(inst.phone), inst.email].filter(Boolean).join(' • ');
      const statusBadge = inst.active
        ? '<span class="badge badge-success">Ativo</span>'
        : '<span class="badge badge-danger">Inativo</span>';
      const toggleLabel = inst.active ? 'Desativar' : 'Ativar';

      return `
        <tr>
          <td>
            <strong>${escapeHtml(inst.name)}</strong>
            ${inst.bio ? `<div class="muted" style="font-size: 0.85rem;">${escapeHtml(inst.bio)}</div>` : ''}
          </td>
          <td>${contacts ? escapeHtml(contacts) : '<span class="muted">—</span>'}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="row-actions">
              <button type="button" class="btn btn-secondary btn-small" data-action="edit" data-id="${inst.id}">
                Editar
              </button>
              <button type="button" class="btn ${inst.active ? 'btn-danger' : 'btn-secondary'} btn-small" data-action="toggle" data-id="${inst.id}">
                ${toggleLabel}
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function loadInstructors() {
  try {
    instructorsCache = (await api('/api/admin/instructors')) ?? [];
    renderInstructors();
  } catch (err) {
    showAlert(alertEl, err.message);
  }
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(form);
  showAlert(alertEl, '');

  const id = form.elements.id.value.trim();
  const body = {
    name: form.elements.name.value,
    phone: form.elements.phone.value,
    email: form.elements.email.value,
    bio: form.elements.bio.value,
    active: form.elements.active.checked,
  };

  submitBtn.disabled = true;
  try {
    if (id) {
      await api(`/api/admin/instructors/${encodeURIComponent(id)}`, { method: 'PUT', body });
      showAlert(alertEl, 'Instrutor atualizado com sucesso.', 'success');
    } else {
      await api('/api/admin/instructors', { method: 'POST', body });
      showAlert(alertEl, 'Instrutor cadastrado com sucesso.', 'success');
    }
    resetForm();
    await loadInstructors();
  } catch (err) {
    handleFormError(form, alertEl, err);
  } finally {
    submitBtn.disabled = false;
  }
});

cancelEditBtn?.addEventListener('click', () => {
  resetForm();
  showAlert(alertEl, '');
});

tbody?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const instructor = instructorsCache.find((item) => item.id === id);
  if (!instructor) return;

  if (button.dataset.action === 'edit') {
    startEdit(instructor);
    return;
  }

  if (button.dataset.action === 'toggle') {
    const nextActive = !instructor.active;
    if (!nextActive) {
      const confirmed = window.confirm(
        `Desativar o instrutor "${instructor.name}"? Ele deixará de aparecer para novas atividades.`,
      );
      if (!confirmed) return;
    }

    button.disabled = true;
    showAlert(alertEl, '');
    try {
      await api(`/api/admin/instructors/${id}`, {
        method: 'PUT',
        body: {
          name: instructor.name,
          phone: instructor.phone,
          email: instructor.email,
          bio: instructor.bio,
          active: nextActive,
        },
      });
      showAlert(
        alertEl,
        nextActive ? 'Instrutor ativado com sucesso.' : 'Instrutor desativado com sucesso.',
        'success',
      );
      await loadInstructors();
    } catch (err) {
      showAlert(alertEl, err.message);
    } finally {
      button.disabled = false;
    }
  }
});

await loadInstructors();