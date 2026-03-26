(function () {
  const CONSENT_KEY = 'ntport_cookie_pref';
  const USERS_KEY = 'ntport_users';
  const SESSION_KEY = 'ntport_session';
  const ACTIVITY_KEY = 'ntport_activity';

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const protectedPages = new Set(['dashboard.html', 'profile.html', 'settings.html']);

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function hashPassword(password) {
    let hash = 5381;
    for (let i = 0; i < password.length; i++) {
      hash = ((hash << 5) + hash) + password.charCodeAt(i);
      hash &= 0xffffffff;
    }
    return `demo-${Math.abs(hash)}`;
  }

  function currentSession() {
    return readJSON(SESSION_KEY, null);
  }

  function getUsers() {
    return readJSON(USERS_KEY, []);
  }

  function saveUsers(users) {
    writeJSON(USERS_KEY, users);
  }

  function trackActivity(username, title, description) {
    const map = readJSON(ACTIVITY_KEY, {});
    const events = map[username] || [];
    events.unshift({ title, description, created_at: new Date().toISOString() });
    map[username] = events.slice(0, 8);
    writeJSON(ACTIVITY_KEY, map);
  }

  function requireAuth() {
    const session = currentSession();
    if (protectedPages.has(currentPath) && !session?.username) {
      window.location.href = 'login.html';
      return null;
    }
    return session;
  }

  function bindCookieConsent() {
    const banner = document.getElementById('cookie-consent');
    if (!banner) return;
    if (!localStorage.getItem(CONSENT_KEY)) banner.classList.remove('hidden');
    banner.querySelectorAll('button[data-consent]').forEach((button) => {
      button.addEventListener('click', () => {
        localStorage.setItem(CONSENT_KEY, button.dataset.consent);
        banner.classList.add('hidden');
      });
    });
  }

  function refreshNav(session) {
    document.querySelectorAll('[data-auth-only]').forEach((el) => {
      el.style.display = session?.username ? '' : 'none';
    });
    document.querySelectorAll('[data-guest-only]').forEach((el) => {
      el.style.display = session?.username ? 'none' : '';
    });
  }

  function bindLogout() {
    document.querySelectorAll('[data-logout]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem(SESSION_KEY);
        window.location.href = 'index.html';
      });
    });
  }

  function bindSignup() {
    const form = document.getElementById('signup-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const username = String(fd.get('username') || '').trim().toLowerCase();
      const password = String(fd.get('password') || '');
      const full_name = String(fd.get('full_name') || '').trim();
      const message = document.getElementById('form-message');

      if (username.length < 3) {
        message.textContent = 'Username must be at least 3 characters.';
        message.className = 'flash error';
        return;
      }
      if (password.length < 8) {
        message.textContent = 'Password must be at least 8 characters.';
        message.className = 'flash error';
        return;
      }

      const users = getUsers();
      if (users.some((u) => u.username === username)) {
        message.textContent = 'This username is already taken.';
        message.className = 'flash error';
        return;
      }

      users.push({
        username,
        full_name,
        role: 'Operator',
        created_at: new Date().toISOString(),
        password_hash: hashPassword(password),
      });
      saveUsers(users);
      message.textContent = 'Account created. You can now log in.';
      message.className = 'flash success';
      form.reset();
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 600);
    });
  }

  function bindLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const username = String(fd.get('username') || '').trim().toLowerCase();
      const password = String(fd.get('password') || '');
      const message = document.getElementById('form-message');
      const user = getUsers().find((u) => u.username === username);

      if (!user || user.password_hash !== hashPassword(password)) {
        message.textContent = 'Invalid username or password.';
        message.className = 'flash error';
        return;
      }

      writeJSON(SESSION_KEY, { username });
      trackActivity(username, 'Secure Login', 'Authenticated from NTPORT credential gateway.');
      message.textContent = 'Welcome back to NTPORT.';
      message.className = 'flash success';
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 400);
    });
  }

  function hydrateUserViews(session) {
    if (!session?.username) return;
    const user = getUsers().find((u) => u.username === session.username);
    if (!user) return;

    document.querySelectorAll('[data-user-fullname]').forEach((el) => {
      el.textContent = user.full_name || user.username;
    });
    document.querySelectorAll('[data-user-username]').forEach((el) => {
      el.textContent = `@${user.username}`;
    });
    document.querySelectorAll('[data-user-role]').forEach((el) => {
      el.textContent = user.role || 'Operator';
    });
    document.querySelectorAll('[data-user-joined]').forEach((el) => {
      el.textContent = user.created_at;
    });

    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      settingsForm.full_name.value = user.full_name || '';
      settingsForm.role.value = user.role || 'Operator';
      settingsForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const users = getUsers();
        const i = users.findIndex((u) => u.username === session.username);
        users[i].full_name = settingsForm.full_name.value.trim();
        users[i].role = settingsForm.role.value.trim() || 'Operator';
        saveUsers(users);
        trackActivity(session.username, 'Profile Updated', 'Updated personal settings and dashboard identity metadata.');
        const msg = document.getElementById('settings-message');
        msg.textContent = 'Settings saved.';
        msg.className = 'flash success';
        hydrateUserViews(session);
      });
    }

    const activity = readJSON(ACTIVITY_KEY, {})[session.username] || [];
    const activityList = document.getElementById('activity-list');
    if (activityList) {
      activityList.innerHTML = activity.length
        ? activity.map((item) => `<li><h4>${item.title}</h4><p>${item.description}</p><small>${item.created_at}</small></li>`).join('')
        : '<li><p>No recent events yet.</p></li>';
    }
  }

  const session = requireAuth();
  bindCookieConsent();
  refreshNav(session);
  bindLogout();
  bindSignup();
  bindLogin();
  hydrateUserViews(session);
})();
