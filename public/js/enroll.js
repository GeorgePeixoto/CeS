import {
  api,
  clearFieldErrors,
  handleFormError,
  showAlert,
} from './api.js';

const form = document.querySelector('#enroll-form');
const fieldset = document.querySelector('#enroll-fieldset');
const soldoutAlertEl = document.querySelector('#enroll-soldout-alert');
const alertEl = document.querySelector('#enroll-alert');
const birthDateInput = document.querySelector('#enroll-birth-date');
const guardianFieldsEl = document.querySelector('#guardian-fields');
const consentLabelEl = document.querySelector('#enroll-consent-label');
const submitBtn = document.querySelector('#enroll-submit');
const successEl = document.querySelector('#enroll-success');
const protocolCodeEl = document.querySelector('#enroll-protocol-code');
const lookupLinkEl = document.querySelector('#enroll-lookup-link');

const fortalezaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Fortaleza',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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

  if (isMinor) {
    guardianFieldsEl?.classList.remove('hidden');
    if (consentLabelEl) {
      consentLabelEl.textContent =
        'Como responsável legal, concordo com o uso dos dados do menor para organização das atividades do Núcleo Marcus Jussier.';
    }
  } else {
    guardianFieldsEl?.classList.add('hidden');
    if (consentLabelEl) {
      consentLabelEl.textContent =
        'Concordo com o uso dos meus dados para organização das atividades do Núcleo Marcus Jussier.';
    }
  }
}

async function initEnrollmentForm() {
  const params = new URLSearchParams(window.location.search);
  const activityId = params.get('id');
  if (!activityId || !form) return;

  try {
    const activity = await api(`/api/activities/${encodeURIComponent(activityId)}`);
    if (!activity) return;

    if (activity.soldOut) {
      soldoutAlertEl?.classList.remove('hidden');
      if (fieldset) fieldset.disabled = true;
    }
  } catch {
    // O alerta principal de carregamento é tratado pelo activity.js
  }

  birthDateInput?.addEventListener('change', updateGuardianVisibility);
  birthDateInput?.addEventListener('input', updateGuardianVisibility);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    showAlert(alertEl, '');

    const age = calculateAgeInFortaleza(form.elements.birthDate.value);
    const isMinor = age !== null && age >= 0 && age < 18;

    const body = {
      name: form.elements.name.value,
      phone: form.elements.phone.value,
      email: form.elements.email.value,
      birthDate: form.elements.birthDate.value,
      guardianName: isMinor ? form.elements.guardianName.value : null,
      guardianPhone: isMinor ? form.elements.guardianPhone.value : null,
      consent: form.elements.consent.checked,
    };

    submitBtn.disabled = true;
    try {
      const result = await api(`/api/activities/${encodeURIComponent(activityId)}/enrollments`, {
        method: 'POST',
        body,
      });

      form.classList.add('hidden');
      soldoutAlertEl?.classList.add('hidden');
      if (protocolCodeEl) protocolCodeEl.textContent = result.protocol;
      if (lookupLinkEl) {
        const lookupParams = new URLSearchParams({
          protocol: result.protocol,
          phone: form.elements.phone.value.replace(/\D/g, ''),
        });
        lookupLinkEl.href = `/consulta.html?${lookupParams.toString()}`;
      }
      successEl?.classList.remove('hidden');

      // Atualiza o contador de vagas exibido no detalhe sem recarregar a página
      const updatedActivity = await api(`/api/activities/${encodeURIComponent(activityId)}`);
      if (updatedActivity) {
        const metaItems = document.querySelectorAll('#activity-detail .meta li');
        for (const li of metaItems) {
          if (li.textContent.startsWith('Vagas:')) {
            li.innerHTML =
              updatedActivity.seatsAvailable <= 0
                ? '<strong>Vagas:</strong> Esgotado'
                : `<strong>Vagas:</strong> ${updatedActivity.seatsAvailable} ${
                    updatedActivity.seatsAvailable === 1 ? 'vaga disponível' : 'vagas disponíveis'
                  } (de ${updatedActivity.capacity})`;
          }
        }
      }
    } catch (err) {
      handleFormError(form, alertEl, err);
    } finally {
      submitBtn.disabled = false;
    }
  });
}

initEnrollmentForm();