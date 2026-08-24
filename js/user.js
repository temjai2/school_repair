seedDB();

const me = requireRole('user');
bindLogout();

const tabs = document.querySelectorAll('.tab-link');
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'tabMyList') renderMyList();
  });
});

(function fillSelects() {
  const loc = document.getElementById('fLocation');
  const cat = document.getElementById('fCategory');
  LOCATIONS.forEach(x => loc.insertAdjacentHTML('beforeend', `<option value="${esc(x)}">${esc(x)}</option>`));
  CATEGORIES.forEach(x => cat.insertAdjacentHTML('beforeend', `<option value="${esc(x)}">${esc(x)}</option>`));
})();

document.getElementById('repairForm').addEventListener('submit', e => {
  e.preventDefault();
  const repair = DB.addRepair({
    title: document.getElementById('fTitle').value.trim(),
    location: document.getElementById('fLocation').value,
    category: document.getElementById('fCategory').value,
    priority: document.querySelector('input[name="priority"]:checked').value,
    description: document.getElementById('fDesc').value.trim(),
    reporterId: me.id
  });
  e.target.reset();
  showToast(`ส่งแบบแจ้งซ่อม ${repair.id} เรียบร้อยแล้ว รอเจ้าหน้าที่ตรวจสอบ`);
  tabs.forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="tabMyList"]').classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('tabMyList').classList.add('active');
  renderMyList();
});

function myRepairs() {
  return DB.repairs().filter(r => r.reporterId === me.id);
}

function activeRow(r) {
  return `
    <td><span class="code-tag">${r.id}</span></td>
    <td><div class="cell-main">${esc(r.title)}</div><div class="cell-sub">${esc(r.location)}</div></td>
    <td><span class="chip">${esc(r.category)}</span></td>
    <td>${priorityBadge(r.priority)}</td>
    <td>${statusBadge(r.status)}</td>
    <td style="white-space:nowrap;font-size:.8rem;color:var(--muted)">${fmtDateTime(r.createdAt)}</td>
    <td><div class="actions">
      <button class="btn btn-outline btn-sm" data-view="${r.id}">รายละเอียด</button>
      ${r.status === STATUS.PENDING ? `<button class="btn btn-danger btn-sm" data-cancel="${r.id}">ยกเลิก</button>` : ''}
    </div></td>`;
}

function historyRow(r) {
  return `
    <td><span class="code-tag">${r.id}</span></td>
    <td><div class="cell-main">${esc(r.title)}</div><div class="cell-sub">${esc(r.location)}</div></td>
    <td>${statusBadge(r.status)}</td>
    <td style="white-space:nowrap;font-size:.8rem;color:var(--muted)">${fmtDateTime(r.createdAt)}</td>
    <td style="white-space:nowrap;font-size:.8rem;color:var(--muted)">${r.finishedAt ? fmtDateTime(r.finishedAt) : '-'}</td>
    <td><div class="actions"><button class="btn btn-outline btn-sm" data-view="${r.id}">รายละเอียด</button></div></td>`;
}

function renderMyList() {
  const all = myRepairs();
  const active = all.filter(r => ACTIVE_STATUSES.includes(r.status));
  const history = all.filter(r => CLOSED_STATUSES.includes(r.status));

  document.getElementById('myStats').innerHTML = `
    <div class="mini-stat">แจ้งซ่อมทั้งหมด<b>${all.length}</b></div>
    <div class="mini-stat">กำลังดำเนินการ<b>${active.length}</b></div>
    <div class="mini-stat">ซ่อมเสร็จแล้ว<b>${history.filter(r => r.status === STATUS.DONE).length}</b></div>`;

  document.getElementById('cntMyActive').textContent = active.length;
  document.getElementById('cntMyDone').textContent = history.length;

  const aBody = document.getElementById('myActiveBody');
  const hBody = document.getElementById('myHistoryBody');
  aBody.innerHTML = active.map(activeRow).join('');
  hBody.innerHTML = history.map(historyRow).join('');
  document.getElementById('myActiveEmpty').hidden = active.length > 0;
  document.getElementById('myHistoryEmpty').hidden = history.length > 0;
}

async function handleListClick(e) {
  const viewBtn = e.target.closest('[data-view]');
  const cancelBtn = e.target.closest('[data-cancel]');
  if (viewBtn) showDetail(viewBtn.dataset.view);
  if (cancelBtn) {
    const id = cancelBtn.dataset.cancel;
    const ok = await confirmDialog('ยกเลิกแจ้งซ่อม', `ต้องการยกเลิกรายการ ${id} ใช่หรือไม่ ?`, 'ยกเลิกรายการ');
    if (!ok) return;
    DB.updateRepair(id, { status: STATUS.CANCELLED });
    showToast(`ยกเลิก ${id} เรียบร้อยแล้ว`, 'info');
    closeModal('confirmModal');
    renderMyList();
  }
}

['myActiveBody', 'myHistoryBody'].forEach(id => {
  document.getElementById(id).addEventListener('click', handleListClick);
});

function showDetail(id) {
  const r = DB.repairs().find(x => x.id === id);
  if (!r) return;
  const tech = r.techId ? DB.findUser(r.techId) : null;
  document.getElementById('dCode').textContent = r.id;
  document.getElementById('detailBody').innerHTML = `
    <dl class="detail-list">
      <div class="detail-row"><dt>สถานะ</dt><dd>${statusBadge(r.status)} &nbsp; ${priorityBadge(r.priority)}</dd></div>
      <div class="detail-row"><dt>หัวข้อ</dt><dd>${esc(r.title)}</dd></div>
      <div class="detail-row"><dt>สถานที่</dt><dd>${esc(r.location)}</dd></div>
      <div class="detail-row"><dt>หมวดงาน</dt><dd><span class="chip">${esc(r.category)}</span></dd></div>
      <div class="detail-row"><dt>ผู้รับผิดชอบ</dt><dd>${tech ? esc(tech.name) : '<span style="color:var(--muted)">รอผู้ดูแลระบบมอบหมายช่าง</span>'}</dd></div>
      <div class="detail-row"><dt>วันที่แจ้ง</dt><dd>${fmtDateTime(r.createdAt)}</dd></div>
      <div class="detail-row"><dt>อัปเดตล่าสุด</dt><dd>${fmtDateTime(r.updatedAt)}</dd></div>
      ${r.finishedAt ? `<div class="detail-row"><dt>วันที่เสร็จ</dt><dd>${fmtDateTime(r.finishedAt)}</dd></div>` : ''}
      <div class="detail-row"><dt>รายละเอียด</dt><dd><div class="desc-box">${esc(r.description)}</div></dd></div>
      ${r.status === STATUS.DONE && r.finishNote ? `<div class="detail-row"><dt>ผลการซ่อม</dt><dd><div class="finish-note">${esc(r.finishNote)}${r.rating ? ` &nbsp;|&nbsp; คุณให้คะแนน ${r.rating}/5` : ''}</div></dd></div>` : ''}
      ${r.status === STATUS.CANCELLED && r.finishNote ? `<div class="detail-row"><dt>หมายเหตุ</dt><dd><div class="desc-box">${esc(r.finishNote)}</div></dd></div>` : ''}
    </dl>`;
  openModal('detailModal');
}
