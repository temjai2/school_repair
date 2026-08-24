const DB_KEYS = {
  USERS: 'sr_users',
  REPAIRS: 'sr_repairs',
  SESSION: 'sr_session'
};

const CATEGORIES = ['ไฟฟ้า', 'ประปา', 'เครื่องมืออิเล็กทรอนิกส์', 'อาคารและเฟอร์นิเจอร์', 'สิ่งแวดล้อม', 'อื่น ๆ'];

const LOCATIONS = [
  'อาคารเรียน 1', 'อาคารเรียน 2', 'อาคารเรียน 3', 'ห้องสมุด',
  'โรงอาหาร', 'หอประชุม', 'สำนักงานผู้อำนวยการ', 'ห้องปฏิบัติการวิทยาศาสตร์',
  'ห้องคอมพิวเตอร์', 'โรงยิม / สนามกีฬา', 'ห้องน้ำ', 'บริเวณโรงเรียน'
];

const STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CANCELLED: 'cancelled'
};

const STATUS_META = {
  pending: { label: 'รอดำเนินการ', color: '#f59e0b' },
  assigned: { label: 'มอบหมายแล้ว', color: '#3b82f6' },
  in_progress: { label: 'กำลังซ่อม', color: '#8b5cf6' },
  done: { label: 'เสร็จสิ้น', color: '#10b981' },
  cancelled: { label: 'ยกเลิก', color: '#94a3b8' }
};

const PRIORITY_META = {
  normal: { label: 'ปกติ', color: '#10b981' },
  urgent: { label: 'เร่งด่วน', color: '#f59e0b' },
  emergency: { label: 'ฉุกเฉิน', color: '#ef4444' }
};

const ROLE_META = {
  admin: { label: 'ผู้ดูแลระบบ', home: 'admin.html' },
  tech: { label: 'ช่างซ่อม', home: 'tech.html' },
  user: { label: 'ผู้แจ้งซ่อม', home: 'user.html' }
};

const ACTIVE_STATUSES = [STATUS.PENDING, STATUS.ASSIGNED, STATUS.IN_PROGRESS];
const CLOSED_STATUSES = [STATUS.DONE, STATUS.CANCELLED];

const DB = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },

  write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  users() {
    return this.read(DB_KEYS.USERS, []);
  },

  saveUsers(users) {
    this.write(DB_KEYS.USERS, users);
  },

  repairs() {
    return this.read(DB_KEYS.REPAIRS, []).map(r => ({ ...r, finishedAt: r.finishedAt || null }));
  },

  saveRepairs(repairs) {
    this.write(DB_KEYS.REPAIRS, repairs);
  },

  session() {
    return this.read(DB_KEYS.SESSION, null);
  },

  saveSession(session) {
    this.write(DB_KEYS.SESSION, session);
  },

  clearSession() {
    localStorage.removeItem(DB_KEYS.SESSION);
  },

  currentUser() {
    const s = this.session();
    if (!s) return null;
    return this.users().find(u => u.id === s.userId) || null;
  },

  findUser(id) {
    return this.users().find(u => u.id === id) || null;
  },

  technicians() {
    return this.users().filter(u => u.role === 'tech');
  },

  usernameExists(username, exceptId = null) {
    const u = String(username).trim().toLowerCase();
    return this.users().some(x => x.username.toLowerCase() === u && x.id !== exceptId);
  },

  register(data) {
    const users = this.users();
    const user = {
      id: this.nextCode('U', users),
      username: data.username.trim().toLowerCase(),
      password: data.password,
      name: data.name.trim(),
      role: 'user',
      phone: data.phone ? data.phone.trim() : ''
    };
    users.push(user);
    this.saveUsers(users);
    return user;
  },

  nextCode(prefix, list) {
    const nums = list
      .map(item => parseInt(String(item.id).replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 1000) + 1;
    return prefix + String(next);
  },

  addRepair(data) {
    const repairs = this.repairs();
    const repair = {
      id: this.nextCode('R', repairs),
      title: data.title,
      location: data.location,
      category: data.category,
      priority: data.priority,
      status: STATUS.PENDING,
      reporterId: data.reporterId,
      techId: null,
      description: data.description,
      finishNote: '',
      rating: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finishedAt: null
    };
    repairs.unshift(repair);
    this.saveRepairs(repairs);
    return repair;
  },

  updateRepair(id, changes) {
    const repairs = this.repairs();
    const repair = repairs.find(x => x.id === id);
    if (!repair) return null;
    const patch = { ...changes };
    if (patch.status === STATUS.DONE && !repair.finishedAt) {
      patch.finishedAt = new Date().toISOString();
    }
    Object.assign(repair, patch, { updatedAt: new Date().toISOString() });
    this.saveRepairs(repairs);
    return repair;
  }
};

function seedDB() {
  if (localStorage.getItem(DB_KEYS.USERS)) return;

  const users = [
    { id: 'U1001', username: 'admin', password: 'admin123', name: 'ผู้ดูแลระบบ', role: 'admin', phone: '0-2000-0000' },
    { id: 'U1002', username: 'teacher', password: '123456', name: 'ครูสมชาย ใจดี', role: 'user', phone: '081-234-5678' },
    { id: 'U1003', username: 'student', password: '123456', name: 'นักเรียนสมหญิง ตั้งใจ', role: 'user', phone: '-' },
    { id: 'U1004', username: 'tech_elec', password: '123456', name: 'ช่างวิชัย (ไฟฟ้า)', role: 'tech', phone: '089-111-2222' },
    { id: 'U1005', username: 'tech_plumb', password: '123456', name: 'ช่างปรีชา (ประปา)', role: 'tech', phone: '089-333-4444' }
  ];

  const now = Date.now();
  const day = 86400000;

  const repairs = [
    {
      id: 'R1001', title: 'ไฟห้องเรียนไม่ติด 3 ดวง', location: 'อาคารเรียน 1', category: 'ไฟฟ้า',
      priority: 'urgent', status: 'assigned', reporterId: 'U1002', techId: 'U1004',
      description: 'ไฟฟลูออเรสเซนต์ฝั่งขวาของห้องไม่ติดทั้ง 3 ดวง กระพริบแล้วดับ นักเรียนเรียนสายตาเสี่ยง',
      finishNote: '', rating: 0, finishedAt: null,
      createdAt: new Date(now - day * 2).toISOString(), updatedAt: new Date(now - day * 1.5).toISOString()
    },
    {
      id: 'R1002', title: 'ก๊อกน้ำห้องน้ำชำรุด น้ำไหลไม่หยุด', location: 'ห้องน้ำ', category: 'ประปา',
      priority: 'urgent', status: 'in_progress', reporterId: 'U1003', techId: 'U1005',
      description: 'ก๊อกน้ำชั้น 2 หัก น้ำไหลตลอดเวลา เปลืองน้ำมาก',
      finishNote: '', rating: 0, finishedAt: null,
      createdAt: new Date(now - day * 1).toISOString(), updatedAt: new Date(now - day * 0.5).toISOString()
    },
    {
      id: 'R1003', title: 'เก้าอี้ห้องเรียนหัก 1 ตัว', location: 'อาคารเรียน 2', category: 'อาคารและเฟอร์นิเจอร์',
      priority: 'normal', status: 'pending', reporterId: 'U1003', techId: null,
      description: 'ขาเก้าอี้ไม้หักข้างหนึ่ง เสี่ยงนักเรียนล้ม รบกวนเปลี่ยนให้ด้วยครับ',
      finishNote: '', rating: 0, finishedAt: null,
      createdAt: new Date(now - day * 0.2).toISOString(), updatedAt: new Date(now - day * 0.2).toISOString()
    },
    {
      id: 'R1004', title: 'เบรกเกอร์ตู้หลักรื้น เครื่องใช้ไฟฟ้าใช้ไม่ได้', location: 'โรงอาหาร', category: 'ไฟฟ้า',
      priority: 'emergency', status: 'done', reporterId: 'U1002', techId: 'U1004',
      description: 'ตู้เบรกเกอร์หลักของโรงอาหารตัดวงจรบ่อย แก๊สหุงติดๆ ดับๆ',
      finishNote: 'เปลี่ยนเบรกเกอร์ 30A ใหม่ ทดสอบโหลดแล้วปกติ', rating: 5,
      createdAt: new Date(now - day * 4).toISOString(), updatedAt: new Date(now - day * 3).toISOString(),
      finishedAt: new Date(now - day * 3).toISOString()
    },
    {
      id: 'R1005', title: 'โปรเจกเตอร์ห้อง 204 ภาพเบลอ', location: 'อาคารเรียน 3', category: 'เครื่องมืออิเล็กทรอนิกส์',
      priority: 'normal', status: 'pending', reporterId: 'U1002', techId: null,
      description: 'ภาพโปรเจกเตอร์เบลอมาก ล้างเลนส์แล้วยังเบลอ น่าจะถึงคิวเปลี่ยนหลอด',
      finishNote: '', rating: 0, finishedAt: null,
      createdAt: new Date(now - day * 0.8).toISOString(), updatedAt: new Date(now - day * 0.8).toISOString()
    },
    {
      id: 'R1006', title: 'ท่อน้ำประปาแตกหน้าสนาม', location: 'บริเวณโรงเรียน', category: 'ประปา',
      priority: 'emergency', status: 'done', reporterId: 'U1003', techId: 'U1005',
      description: 'ท่อ PVC แตก น้ำท่วมบริเวณทางเดินหน้าสนามฟุตบอล ลื่นเสี่ยงอันตราย',
      finishNote: 'ตัดท่อส่วนที่แตก เปลี่ยนข้อต่อใหม่ ทดสอบความดันแล้ว', rating: 4,
      createdAt: new Date(now - day * 6).toISOString(), updatedAt: new Date(now - day * 5.5).toISOString(),
      finishedAt: new Date(now - day * 5.5).toISOString()
    },
    {
      id: 'R1007', title: 'ขอตัดหญ้าบริเวณสวนหย่อม', location: 'บริเวณโรงเรียน', category: 'สิ่งแวดล้อม',
      priority: 'normal', status: 'cancelled', reporterId: 'U1002', techId: null,
      description: 'หญ้ารกปิดป้ายชื่อพรรณไม้ในสวนหย่อม',
      finishNote: 'ออกนอกขอบเขตงานซ่อม โอนย้ายไปแผนงานสวัสดิการแล้ว', rating: 0, finishedAt: null,
      createdAt: new Date(now - day * 7).toISOString(), updatedAt: new Date(now - day * 6.8).toISOString()
    }
  ];

  DB.saveUsers(users);
  DB.saveRepairs(repairs);
}
