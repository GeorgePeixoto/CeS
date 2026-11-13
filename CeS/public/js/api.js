// Thin fetch wrapper for the JSON API. Resolves with `data`, rejects with ApiError.

export class ApiError extends Error {
  constructor(status, { code = 'UNKNOWN', message = 'Algo deu errado. Tente novamente.', fields } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK', message: 'Sem conexão com o servidor.' });
  }
  if (res.status === 204) return null;
  let json = null;
  try { json = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) throw new ApiError(res.status, json?.error);
  return json?.data ?? null;
}

/** Shows a message in an `.alert` element. */
export function showAlert(element, message, type = 'error') {
  if (!element) return;
  element.className = `alert alert-${type}`;
  element.textContent = message || '';
  if (message) element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function clearFieldErrors(form) {
  form.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  form.querySelectorAll('.field-error').forEach((e) => e.remove());
}

/** Renders `fields` from a VALIDATION_ERROR next to inputs whose name matches. */
export function showFieldErrors(form, fields = {}) {
  clearFieldErrors(form);
  for (const [name, message] of Object.entries(fields)) {
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    const field = input?.closest('.field');
    if (!field) continue;
    field.classList.add('has-error');
    const error = document.createElement('span');
    error.className = 'field-error';
    error.textContent = message;
    field.append(error);
  }
}

/** Standard handling for a failed form submission. */
export function handleFormError(form, alertElement, err) {
  if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') showFieldErrors(form, err.fields);
  showAlert(alertElement, err.message);
}

/** Escapes text for safe use inside template literals that become innerHTML. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
