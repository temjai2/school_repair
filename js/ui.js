function requireRole(role) {
  const user = DB.currentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  if (role && user.role !== role) {
    window.location.href = ROLE_META[user.role].home;
    return null;
  }
  document.querySelectorAll('[data-user-name]').forEach(el => {
    el.textContent = user.name;
  });
  document.querySelectorAll('[data-user-avatar]').forEach(el => {
    el.textContent = user.name.trim().charAt(0);
  });
  return user;
}

function logout() {
  DB.clearSession();
  window.location.href = 'index.html';
}

function bindLogout() {
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', logout);
  });
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time} น.`;
}

function statusBadge(status) {
  return `<span class="badge st-${status}">${STATUS_META[status].label}</span>`;
}

function priorityBadge(priority) {
  return `<span class="badge pr-${priority}">${PRIORITY_META[priority].label}</span>`;
}

function roleBadge(role) {
  return `<span class="badge role-${role}">${ROLE_META[role].label}</span>`;
}

function showToast(message, type = 'success') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  wrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 350);
  }, 3200);
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

document.addEventListener('click', e => {
  if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
  }
});

let confirmResolver = null;

function confirmDialog(title, message, okText = 'ยืนยัน') {
  return new Promise(resolve => {
    confirmResolver = resolve;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmOkBtn').textContent = okText;
    openModal('confirmModal');
  });
}

(function initConfirm() {
  const modal = document.getElementById('confirmModal');
  if (!modal) return;

  function settle(result) {
    if (confirmResolver) {
      const r = confirmResolver;
      confirmResolver = null;
      r(result);
    }
    modal.classList.remove('open');
  }

  document.getElementById('confirmOkBtn').addEventListener('click', () => settle(true));
  document.getElementById('confirmCancelBtn').addEventListener('click', () => settle(false));
  modal.querySelector('.modal-close').addEventListener('click', () => settle(false));
  modal.addEventListener('click', e => {
    if (e.target === modal) settle(false);
  });
})();
