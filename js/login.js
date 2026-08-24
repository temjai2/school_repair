seedDB();

(function redirectIfLoggedIn() {
  const user = DB.currentUser();
  if (user) window.location.href = ROLE_META[user.role].home;
})();

const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');

form.addEventListener('submit', e => {
  e.preventDefault();
  errorBox.hidden = true;

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const found = DB.users().find(u => u.username === username && u.password === password);

  if (!found) {
    errorBox.textContent = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง';
    errorBox.hidden = false;
    return;
  }

  DB.saveSession({ userId: found.id, loginAt: new Date().toISOString() });
  window.location.href = ROLE_META[found.role].home;
});

document.querySelectorAll('.demo-row').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('username').value = btn.dataset.u;
    document.getElementById('password').value = btn.dataset.p;
    errorBox.hidden = true;
  });
});
