// Contact form handler.
//
// Set FORM_ENDPOINT to the URL your form service gives you (for example a
// Formspree or Web3Forms endpoint). Until it is set, the form stays hidden and a
// notice is shown, so visitors are never given a form that goes nowhere.
// Do not put secret keys here: this file is public. Form endpoints are designed
// to be public; keep any private keys in the form service's dashboard.
const FORM_ENDPOINT = '';

const form = document.getElementById('contact-form');
const notice = document.getElementById('form-unavailable');
const result = document.getElementById('form-result');

if (!FORM_ENDPOINT) {
  form.hidden = true;
  notice.hidden = false;
} else {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (data.get('website')) return; // honeypot filled: silently drop
    if (!form.checkValidity() || !String(data.get('message')).trim()) {
      result.textContent = 'Please enter a valid email and a message.';
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    result.textContent = 'Sending…';
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      form.reset();
      result.textContent = 'Thanks! Your message was sent.';
    } catch {
      result.textContent = 'Sorry, that did not send. Please try again later.';
    } finally {
      button.disabled = false;
    }
  });
}
