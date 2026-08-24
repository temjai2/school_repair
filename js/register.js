seedDB();

(function redirectIfLoggedIn() {
  const user = DB.currentUser();
  if (user) window.location.href = ROLE_META[user.role].home;
})();

const form = document.getElementById('regForm');
const errorBox = document.getElementById('regError');

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

form.addEventListener('submit', e => {
  e.preventDefault();
  errorBox.hidden = true;

  const name = document.getElementById('rName').value.trim();
  const username = document.getElementById('rUsername').value.trim();
  const password = document.getElementById('rPassword').value;
  const confirm = document.getElementById('rConfirm').value;
  const phone = document.getElementById('rPhone').value.trim();

  if (!/^[A-Za-z0-9_.]+$/.test(username)) {
    return showError('ชื่อผู้ใช้ใช้ได้เฉพาะตัวอังกฤษ ตัวเลข และ _ . เท่านั้น');
  }
  if (password.length < 4) {
    return showError('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
  }
  if (password !== confirm) {
    return showError('รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน');
  }
  if (DB.usernameExists(username)) {
    return showError('ชื่อผู้ใช้ "' + username + '" ถูกใช้ไปแล้ว กรุณาเลือกชื่อใหม่');
  }

  const user = DB.register({ name, username, password, phone });
  DB.saveSession({ userId: user.id, loginAt: new Date().toISOString() });
  window.location.href = 'user.html';
});
