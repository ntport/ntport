(function () {
  const consentKey = 'ntport_cookie_pref';
  const banner = document.getElementById('cookie-consent');
  if (!banner) return;

  const saved = localStorage.getItem(consentKey);
  if (!saved) {
    banner.classList.remove('hidden');
  }

  banner.querySelectorAll('button[data-consent]').forEach((button) => {
    button.addEventListener('click', () => {
      localStorage.setItem(consentKey, button.dataset.consent);
      banner.classList.add('hidden');
    });
  });
})();
