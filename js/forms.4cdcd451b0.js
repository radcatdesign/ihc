/*
 * Form handling for the email sign-up forms (header "Join" popup and footer subscribe).
 * Posts to /api/subscribe and toggles the existing success / error blocks.
 */
(function () {
  function show(el, on) {
    if (el) el.style.display = on ? 'block' : 'none';
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var wrap = form.closest('.w-form');
    if (!wrap) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    var done = wrap.querySelector('.w-form-done');
    var fail = wrap.querySelector('.w-form-fail');
    var btn = form.querySelector('[type="submit"]');
    var label = btn ? btn.value : '';
    if (btn && btn.getAttribute('data-wait')) btn.value = btn.getAttribute('data-wait');
    show(fail, false);

    var fields = {};
    new FormData(form).forEach(function (v, k) { fields[k] = v; });
    var email = '';
    Object.keys(fields).forEach(function (k) {
      if (!email && /@/.test(String(fields[k]))) email = String(fields[k]).trim();
    });

    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        form: form.getAttribute('data-name') || form.name || form.id,
        page: location.pathname,
        fields: fields
      })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        form.style.display = 'none';
        show(done, true);
      })
      .catch(function () {
        show(fail, true);
      })
      .finally(function () {
        if (btn) btn.value = label;
      });
  }, true);
})();
