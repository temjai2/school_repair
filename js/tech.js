seedDB();

const me = requireRole('tech');
bindLogout();

let completingId = null;

const tabs = document.querySelectorAll('.tab-link');
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'tabHistory') renderHistory();
  });
});

function myJobs() {
  return DB.repairs().filter(r => r.techId === me.id);
}

function jobCard(r) {
  const reporter = DB.findUser(r.reporterId);
  const actions =
    r.status === STATUS.ASSIGNED
      ? `<button class="btn btn-sm" data-start="${r.id}">เริ่มดำเนินการ</button>
         <button class="btn btn-outline btn-sm" data-view="${r.id}">รายละเอียด</button>`
      : `<button class="btn btn-success btn-sm" data-complete="${r.id}">แจ้งซ่อมเสร็จ</button>
         <button class="btn btn-outline btn-sm" data-view="${r.id}">รายละเอียด</button>`;
  return `
    <div class="job-card">
      <div class="job-head">
        <div><span class="code-tag">${r.id}</span> ${priorityBadge(r.priority)}</div>
        ${statusBadge(r.status)}
      </div>
      <div class="job-title">${esc(r.title)}</div>
      <div class="job-meta"><span class="chip">${esc(r.location)}</span><span class="chip">${esc(r.category)}</span></div>
      <p class="job-desc">${esc(r.description)}</p>
      <div class="job-foot">
        <time>แจ้งโดย ${reporter ? esc(reporter.name) : '-'} · ${fmtDateTime(r.createdAt)}</time>
        <div style="display:flex;gap:6px">${actions}</div>
      </div>
    </div>`;
}

function renderJobs() {
  const jobs = myJobs();
  const assigned = jobs.filter(r => r.status === STATUS.ASSIGNED);
  const progress = jobs.filter(r => r.status === STATUS.IN_PROGRESS);
  const done = jobs.filter(r => r.status === STATUS.DONE);

  document.getElementById('techStats').innerHTML = `
    <div class="mini-stat">งานที่ได้รับมอบหมาย<b>${jobs.length}</b></div>
    <div class="mini-stat">กำลังดำเนินการ<b>${progress.length}</b></div>
    <div class="mini-stat">ซ่อมเสร็จแล้ว<b>${done.length}</b></div>`;

  document.getElementById('cntAssigned').textContent = assigned.length;
  document.getElementById('cntProgress').textContent = progress.length;

  const aGrid = document.getElementById('assignedGrid');
  const pGrid = document.getElementById('progressGrid');
  aGrid.innerHTML = assigned.map(jobCard).join('');
  pGrid.innerHTML = progress.map(jobCard).join('');
  document.getElementById('assignedEmpty').hidden = assigned.length > 0;
  document.getElementById('progressEmpty').hidden = progress.length > 0;
}

function renderHistory() {
  const rows = myJobs()
    .filter(r => CLOSED_STATUSES.includes(r.status))
    .sort((a, b) => new Date(b.finishedAt || b.updatedAt) - new Date(a.finishedAt || a.updatedAt));
  const body = document.getElementById('historyBody');
  body.innerHTML = '';
  if (!rows.length) {
    document.getElementById('historyEmpty').hidden = false;
    return;
  }
  document.getElementById('historyEmpty').hidden = true;
  rows.forEach(r => {
    const reporter = DB.findUser(r.reporterId);
    body.insertAdjacentHTML('beforeend', `
      <tr>
        <td><span class="code-tag">${r.id}</span></td>
        <td><div class="cell-main">${esc(r.title)}</div><div class="cell-sub">${esc(r.location)}</div></td>
        <td style="font-size:.83rem">${reporter ? esc(reporter.name) : '-'}</td>
        <td>${statusBadge(r.status)}</td>
        <td style="white-space:nowrap;font-size:.8rem;color:var(--muted)">${fmtDateTime(r.createdAt)}</td>
        <td style="white-space:nowrap;font-size:.8rem;color:var(--muted)">${r.finishedAt ? fmtDateTime(r.finishedAt) : '-'}</td>
        <td><div class="actions"><button class="btn btn-outline btn-sm" data-view="${r.id}">ดู</button></div></td>
      </tr>`);
  });
}

document.addEventListener('click', e => {
  const startBtn = e.target.closest('[data-start]');
  const completeBtn = e.target.closest('[data-complete]');
  const viewBtn = e.target.closest('[data-view]');
  if (startBtn) startJob(startBtn.dataset.start);
  if (completeBtn) openComplete(completeBtn.dataset.complete);
  if (viewBtn) showDetail(viewBtn.dataset.view);
});

function startJob(id) {
  DB.updateRepair(id, { status: STATUS.IN_PROGRESS });
  showToast(`เริ่มงาน ${id} เรียบร้อย ขอให้ปลอดภัยในการทำงาน`, 'info');
  renderJobs();
}

function openComplete(id) {
  completingId = id;
  document.getElementById('cCode').textContent = id;
  document.getElementById('cNote').value = '';
  openModal('completeModal');
}

document.getElementById('completeForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!completingId) return;
  DB.updateRepair(completingId, {
    status: STATUS.DONE,
    finishNote: document.getElementById('cNote').value.trim()
  });
  closeModal('completeModal');
  showToast(`งาน ${completingId} เสร็จสิ้น ขอบคุณครับ`);
  completingId = null;
  renderJobs();
});

function showDetail(id) {
  const r = DB.repairs().find(x => x.id === id);
  if (!r) return;
  const reporter = DB.findUser(r.reporterId);
  document.getElementById('dCode').textContent = r.id;
  document.getElementById('detailBody').innerHTML = `
    <dl class="detail-list">
      <div class="detail-row"><dt>สถานะ</dt><dd>${statusBadge(r.status)} &nbsp; ${priorityBadge(r.priority)}</dd></div>
      <div class="detail-row"><dt>หัวข้อ</dt><dd>${esc(r.title)}</dd></div>
      <div class="detail-row"><dt>ผู้แจ้ง</dt><dd>${reporter ? `${esc(reporter.name)} (${reporter.phone || '-'})` : '-'}</dd></div>
      <div class="detail-row"><dt>วันที่แจ้ง</dt><dd>${fmtDateTime(r.createdAt)}</dd></div>
      ${r.finishedAt ? `<div class="detail-row"><dt>วันที่เสร็จ</dt><dd>${fmtDateTime(r.finishedAt)}</dd></div>` : ''}
      <div class="detail-row"><dt>รายละเอียด</dt><dd><div class="desc-box">${esc(r.description)}</div></dd></div>
      ${r.finishNote ? `<div class="detail-row"><dt>หมายเหตุ</dt><dd><div class="finish-note">${esc(r.finishNote)}</div></dd></div>` : ''}
    </dl>`;
  openModal('detailModal');
}

renderJobs();
