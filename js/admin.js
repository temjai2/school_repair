seedDB();

const me = requireRole('admin');
bindLogout();

let assignTargetId = null;

/* ---------- Navigation ---------- */
function showView(target) {
  document.querySelectorAll('.side-item').forEach(b => b.classList.remove('active'));
  const navBtn = document.querySelector(`.side-item[data-view="${target}"]`);
  if (navBtn) navBtn.classList.add('active');
  document.querySelectorAll('.main .view').forEach(v => v.classList.remove('active'));
  document.getElementById(target).classList.add('active');
  if (target === 'viewDashboard') renderDashboard();
}

document.querySelectorAll('.side-item').forEach(el => {
  el.addEventListener('click', () => showView(el.dataset.view));
});

document.querySelectorAll('.stat-card[data-goto-status]').forEach(card => {
  card.addEventListener('click', () => {
    document.getElementById('rStatus').value = card.dataset.gotoStatus;
    renderRepairTable();
    showView('viewRepairs');
  });
});

document.querySelectorAll('[data-view].btn').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

document.getElementById('todayText').textContent =
  'วันนี้ ' + new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

(function fillCategoryFilter() {
  const sel = document.getElementById('rCategory');
  CATEGORIES.forEach(c => sel.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)}</option>`));
})();

/* ---------- Dashboard ---------- */
function countBy(list, fn) {
  return list.reduce((m, x) => {
    const k = fn(x);
    m[k] = (m[k] || 0) + 1;
    return m;
  }, {});
}

const CAT_COLORS = ['#2563eb', '#0891b2', '#8b5cf6', '#f59e0b', '#10b981', '#94a3b8'];

function renderDashboard() {
  const repairs = DB.repairs();
  document.getElementById('stTotal').textContent = repairs.length;
  document.getElementById('stPending').textContent = repairs.filter(r => r.status === STATUS.PENDING).length;
  document.getElementById('stProgress').textContent =
    repairs.filter(r => [STATUS.ASSIGNED, STATUS.IN_PROGRESS].includes(r.status)).length;
  document.getElementById('stDone').textContent = repairs.filter(r => r.status === STATUS.DONE).length;

  renderCatChart(repairs);
  renderDonut(repairs);

  const recent = [...repairs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  document.getElementById('recentBody').innerHTML = recent.map(r => {
    const reporter = DB.findUser(r.reporterId);
    const tech = r.techId ? DB.findUser(r.techId) : null;
    return `<tr>
      <td><span class="code-tag">${r.id}</span></td>
      <td><div class="cell-main">${esc(r.title)}</div><div class="cell-sub">${esc(r.location)}</div></td>
      <td style="font-size:.83rem">${reporter ? esc(reporter.name) : '-'}</td>
      <td>${priorityBadge(r.priority)}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="font-size:.83rem">${tech ? esc(tech.name) : '<span style="color:var(--muted)">-</span>'}</td>
    </tr>`;
  }).join('');
}

function renderCatChart(repairs) {
  const counts = countBy(repairs.filter(r => r.status !== STATUS.CANCELLED), r => r.category);
  const max = Math.max(...Object.values(counts), 1);
  document.getElementById('catChart').innerHTML = CATEGORIES.map((c, i) => {
    const n = counts[c] || 0;
    const pct = (n / max) * 100;
    return `<div class="hbar-row">
      <span class="hbar-label">${esc(c)}</span>
      <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${CAT_COLORS[i % CAT_COLORS.length]}">${n || ''}</div></div>
    </div>`;
  }).join('');
}

function renderDonut(repairs) {
  const donut = document.getElementById('statusDonut');
  const legend = document.getElementById('statusLegend');
  const entries = Object.keys(STATUS_META)
    .map(key => ({ key, meta: STATUS_META[key], count: repairs.filter(r => r.status === key).length }))
    .filter(e => e.count > 0);
  const total = entries.reduce((s, e) => s + e.count, 0);

  legend.innerHTML = entries.map(e =>
    `<div class="legend-row"><span class="legend-dot" style="background:${e.meta.color}"></span>${e.meta.label}<b>${e.count}</b></div>`
  ).join('');

  if (!total) {
    donut.style.background = 'var(--border)';
    return;
  }
  let acc = 0;
  const stops = entries.map(e => {
    const from = (acc / total) * 360;
    acc += e.count;
    const to = (acc / total) * 360;
    return `${e.meta.color} ${from}deg ${to}deg`;
  });
  donut.style.background = `conic-gradient(${stops.join(', ')})`;
}

/* ---------- Repairs table ---------- */
/* ---------- Group tabs (active vs finished) ---------- */
let currentGroup = '';

document.querySelectorAll('#repairGroupTabs .ftab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#repairGroupTabs .ftab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentGroup = tab.dataset.group;
    renderRepairTable();
  });
});

['rSearch', 'rStatus', 'rCategory'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderRepairTable);
});

function filteredRepairs() {
  const q = document.getElementById('rSearch').value.trim().toLowerCase();
  const st = document.getElementById('rStatus').value;
  const cat = document.getElementById('rCategory').value;
  return DB.repairs()
    .filter(r => !currentGroup
      || (currentGroup === 'active' && ACTIVE_STATUSES.includes(r.status))
      || (currentGroup === 'finished' && CLOSED_STATUSES.includes(r.status)))
    .filter(r => !st || r.status === st)
    .filter(r => !cat || r.category === cat)
    .filter(r => {
      if (!q) return true;
      const reporter = DB.findUser(r.reporterId);
      return [r.id, r.title, r.location].some(v => v.toLowerCase().includes(q))
        || (reporter && reporter.name.toLowerCase().includes(q));
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderRepairTable() {
  const rows = filteredRepairs();
  const body = document.getElementById('repairTableBody');
  body.innerHTML = '';
  document.getElementById('repairEmpty').hidden = rows.length > 0;

  rows.forEach(r => {
    const reporter = DB.findUser(r.reporterId);
    const tech = r.techId ? DB.findUser(r.techId) : null;
    const closable = [STATUS.PENDING, STATUS.ASSIGNED].includes(r.status);
    body.insertAdjacentHTML('beforeend', `
      <tr>
        <td><span class="code-tag">${r.id}</span></td>
        <td><div class="cell-main">${esc(r.title)}</div><div class="cell-sub">${esc(r.location)}</div></td>
        <td><span class="chip">${esc(r.category)}</span></td>
        <td style="font-size:.83rem">${reporter ? esc(reporter.name) : '-'}</td>
        <td>${priorityBadge(r.priority)}</td>
        <td style="font-size:.83rem">${tech ? esc(tech.name) : '<span style="color:var(--muted)">ยังไม่มอบหมาย</span>'}</td>
        <td>${statusBadge(r.status)}</td>
        <td style="white-space:nowrap;font-size:.78rem;color:var(--muted);line-height:1.7">
          แจ้ง: ${fmtDateTime(r.createdAt)}<br>
          ${r.finishedAt ? `<b style="color:#047857">เสร็จ:</b> ${fmtDateTime(r.finishedAt)}` : '<span style="opacity:.6">ยังไม่เสร็จ</span>'}
        </td>
        <td><div class="actions">
          ${r.status !== STATUS.DONE && r.status !== STATUS.CANCELLED
            ? `<button class="btn btn-sm" data-assign="${r.id}">${tech ? 'เปลี่ยนช่าง' : 'มอบหมาย'}</button>` : ''}
          <button class="btn btn-outline btn-sm" data-view="${r.id}">ดู</button>
          ${closable ? `<button class="btn btn-danger btn-sm" data-close="${r.id}">ปิดงาน</button>` : ''}
        </div></td>
      </tr>`);
  });
}

document.getElementById('repairTableBody').addEventListener('click', async e => {
  const aBtn = e.target.closest('[data-assign]');
  const vBtn = e.target.closest('[data-view]');
  const cBtn = e.target.closest('[data-close]');
  if (aBtn) openAssign(aBtn.dataset.assign);
  if (vBtn) showDetail(vBtn.dataset.view);
  if (cBtn) {
    const id = cBtn.dataset.close;
    const ok = await confirmDialog('ปิดงาน', `ต้องการปิดงาน ${id} (ตั้งสถานะ "ยกเลิก") ใช่หรือไม่ ?`, 'ปิดงาน');
    closeModal('confirmModal');
    if (!ok) return;
    DB.updateRepair(id, { status: STATUS.CANCELLED, finishNote: 'ปิดงานโดยผู้ดูแลระบบ' });
    showToast(`ปิดงาน ${id} เรียบร้อยแล้ว`, 'info');
    renderRepairTable();
    renderDashboard();
  }
});

/* ---------- Assign modal ---------- */
function openAssign(id) {
  assignTargetId = id;
  const r = DB.repairs().find(x => x.id === id);
  if (!r) return;
  const techs = DB.technicians();
  const techSel = document.getElementById('assignTech');
  techSel.innerHTML = techs.length
    ? techs.map(t => `<option value="${t.id}" ${t.id === r.techId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')
    : `<option value="" disabled selected>-- ยังไม่มีบัญชีช่างในระบบ --</option>`;
  document.getElementById('assignPriority').value = r.priority;
  document.getElementById('assignTitle').textContent = r.techId ? 'เปลี่ยนช่างผู้รับผิดชอบ' : 'มอบหมายงานซ่อม';
  document.getElementById('assignInfo').textContent = `${r.id} · ${r.title} (${r.location})`;
  openModal('assignModal');
}

document.getElementById('assignForm').addEventListener('submit', e => {
  e.preventDefault();
  const techId = document.getElementById('assignTech').value;
  if (!assignTargetId || !techId) {
    showToast('กรุณาเพิ่มบัญชีช่างก่อนมอบหมายงาน', 'error');
    return;
  }
  DB.updateRepair(assignTargetId, {
    status: STATUS.ASSIGNED,
    techId,
    priority: document.getElementById('assignPriority').value
  });
  const tech = DB.findUser(techId);
  closeModal('assignModal');
  showToast(`มอบหมาย ${assignTargetId} ให้ ${tech.name} เรียบร้อย`);
  assignTargetId = null;
  renderRepairTable();
  renderDashboard();
});

/* ---------- Repair detail modal ---------- */
function showDetail(id) {
  const r = DB.repairs().find(x => x.id === id);
  if (!r) return;
  const reporter = DB.findUser(r.reporterId);
  const tech = r.techId ? DB.findUser(r.techId) : null;
  document.getElementById('dCode').textContent = r.id;
  document.getElementById('detailBody').innerHTML = `
    <dl class="detail-list">
      <div class="detail-row"><dt>สถานะ</dt><dd>${statusBadge(r.status)} &nbsp; ${priorityBadge(r.priority)}</dd></div>
      <div class="detail-row"><dt>หัวข้อ</dt><dd>${esc(r.title)}</dd></div>
      <div class="detail-row"><dt>สถานที่</dt><dd>${esc(r.location)}</dd></div>
      <div class="detail-row"><dt>หมวดงาน</dt><dd><span class="chip">${esc(r.category)}</span></dd></div>
      <div class="detail-row"><dt>ผู้แจ้ง</dt><dd>${reporter ? `${esc(reporter.name)} (${reporter.phone || '-'})` : '-'}</dd></div>
      <div class="detail-row"><dt>ช่างผู้รับผิดชอบ</dt><dd>${tech ? esc(tech.name) : '<span style="color:var(--muted)">ยังไม่มอบหมาย</span>'}</dd></div>
      <div class="detail-row"><dt>วันที่แจ้ง</dt><dd>${fmtDateTime(r.createdAt)}</dd></div>
      ${r.finishedAt ? `<div class="detail-row"><dt>วันที่เสร็จ</dt><dd style="color:#047857;font-weight:700">${fmtDateTime(r.finishedAt)}</dd></div>` : ''}
      <div class="detail-row"><dt>รายละเอียด</dt><dd><div class="desc-box">${esc(r.description)}</div></dd></div>
      ${r.finishNote ? `<div class="detail-row"><dt>หมายเหตุ/ผลงาน</dt><dd><div class="finish-note">${esc(r.finishNote)}</div></dd></div>` : ''}
    </dl>`;
  openModal('detailModal');
}

/* ---------- Users management ---------- */
['uSearch', 'uRole'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderUserTable);
});

document.getElementById('addUserBtn').addEventListener('click', () => openUserForm(null));

function filteredUsers() {
  const q = document.getElementById('uSearch').value.trim().toLowerCase();
  const role = document.getElementById('uRole').value;
  return DB.users()
    .filter(u => !role || u.role === role)
    .filter(u => !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
}

function renderUserTable() {
  const rows = filteredUsers();
  const body = document.getElementById('userTableBody');
  body.innerHTML = '';
  document.getElementById('userEmpty').hidden = rows.length > 0;
  rows.forEach(u => {
    body.insertAdjacentHTML('beforeend', `
      <tr>
        <td><span class="code-tag">${u.id}</span></td>
        <td><div class="cell-main">${esc(u.name)}</div><small style="color:var(--muted)">${esc(u.phone || '-')}</small></td>
        <td style="font-family:Consolas,monospace;font-size:.82rem">${esc(u.username)}</td>
        <td>${roleBadge(u.role)}</td>
        <td style="font-size:.84rem">${esc(u.phone || '-')}</td>
        <td><div class="actions">
          <button class="btn btn-outline btn-sm" data-edit="${u.id}">แก้ไข</button>
          ${u.id !== me.id ? `<button class="btn btn-danger btn-sm" data-del="${u.id}">ลบ</button>` : ''}
        </div></td>
      </tr>`);
  });
}

document.getElementById('userTableBody').addEventListener('click', async e => {
  const editBtn = e.target.closest('[data-edit]');
  const delBtn = e.target.closest('[data-del]');
  if (editBtn) openUserForm(editBtn.dataset.edit);
  if (delBtn) {
    const u = DB.findUser(delBtn.dataset.del);
    if (!u) return;
    const hasJobs = DB.repairs().some(r => r.techId === u.id || r.reporterId === u.id);
    const ok = await confirmDialog('ลบผู้ใช้งาน',
      `ต้องการลบบัญชี "${u.name}" (${u.username}) ใช่หรือไม่ ?${hasJobs ? '\n*ผู้ใช้นี้มีประวัติงานผูกอยู่ ระบบจะคงชื่อไว้ในงานเดิม' : ''}`,
      'ลบบัญชี');
    closeModal('confirmModal');
    if (!ok) return;
    DB.saveUsers(DB.users().filter(x => x.id !== u.id));
    showToast('ลบบัญชีเรียบร้อยแล้ว', 'info');
    renderUserTable();
  }
});

function openUserForm(id) {
  const form = document.getElementById('userForm');
  form.reset();
  document.getElementById('uEditId').value = id || '';
  document.getElementById('userModalTitle').textContent = id ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน';
  if (id) {
    const u = DB.findUser(id);
    document.getElementById('uName').value = u.name;
    document.getElementById('uUsername').value = u.username;
    document.getElementById('uPassword').value = u.password;
    document.getElementById('uRoleSelect').value = u.role;
    document.getElementById('uPhone').value = u.phone || '';
  }
  openModal('userModal');
}

document.getElementById('userForm').addEventListener('submit', e => {
  e.preventDefault();
  const users = DB.users();
  const id = document.getElementById('uEditId').value;
  const data = {
    name: document.getElementById('uName').value.trim(),
    username: document.getElementById('uUsername').value.trim().toLowerCase(),
    password: document.getElementById('uPassword').value,
    role: document.getElementById('uRoleSelect').value,
    phone: document.getElementById('uPhone').value.trim()
  };
  if (!data.name || !data.username) return;
  const dup = users.find(u => u.username === data.username && u.id !== id);
  if (dup) {
    showToast('ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาระบุใหม่', 'error');
    return;
  }
  if (id) {
    const u = users.find(x => x.id === id);
    Object.assign(u, data);
    showToast('บันทึกการแก้ไขเรียบร้อยแล้ว');
    if (ROLE_META[data.role].home !== 'admin.html' && me.id === id) {
      window.location.href = ROLE_META[data.role].home;
      return;
    }
  } else {
    users.push({ id: DB.nextCode('U', users), ...data });
    showToast(`เพิ่มบัญชี "${data.name}" เรียบร้อยแล้ว`);
  }
  DB.saveUsers(users);
  closeModal('userModal');
  renderUserTable();
  renderDashboard();
});

/* ---------- Init ---------- */
renderDashboard();
renderRepairTable();
renderUserTable();
