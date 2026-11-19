import { api } from './api.js';

export async function guardAdminPage() {
  let user;
  try {
    user = await api('/api/admin/me');
  } catch (err) {
    if (err.status === 401) {
      window.location.replace('/admin/login.html');
      return null;
    }
    throw err;
  }

  if (!user) {
    window.location.replace('/admin/login.html');
    return null;
  }

  const nameEl = document.querySelector('[data-admin-name]');
  if (nameEl) {
    nameEl.textContent = user.name || user.email;
  }

  const logoutBtn = document.querySelector('[data-admin-logout]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true;
      try {
        await api('/api/admin/logout', { method: 'POST' });
      } finally {
        window.location.replace('/admin/login.html');
      }
    });
  }

  document.body.classList.remove('hidden');
  return user;
}

guardAdminPage();