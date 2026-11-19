import { api, clearFieldErrors, handleFormError, showAlert } from './api.js';

const form = document.querySelector('#login-form');
const alertEl = document.querySelector('#login-alert');
const submitBtn = form?.querySelector('button[type="submit"]');

// Se já houver sessão ativa, vai direto para o painel
api('/api/admin/me')
  .then((user) => {
    if (user) window.location.replace('/admin/index.html');
  })
  .catch(() => {
    // 401 esperado quando não está autenticado
  });

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(form);
  showAlert(alertEl, '');

  const formData = new FormData(form);
  const body = {
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  };

  if (submitBtn) submitBtn.disabled = true;

  try {
    await api('/api/admin/login', { method: 'POST', body });
    window.location.replace('/admin/index.html');
  } catch (err) {
    handleFormError(form, alertEl, err);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});