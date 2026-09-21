import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDB, db } from './db/index.js';
import { authController } from './controllers/authController.js';
import { linkController } from './controllers/linkController.js';
import { redirectController } from './controllers/redirectController.js';
import { domainController } from './controllers/domainController.js';
import { optionalAuth, requireAuth, hashPassword, AuthRequest } from './utils/auth.js';
import { registerRealtimeClient } from './utils/realtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// Khởi tạo Database
initDB();

// Tạo tài khoản Demo mặc định nếu chưa có tài khoản nào
try {
  const userCount: any = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const demoPassword = hashPassword('123456');
    db.prepare(`
      INSERT INTO users (email, password, name, role)
      VALUES (?, ?, ?, ?)
    `).run('admin@boclink.vn', demoPassword, 'Quản Trị Viên', 'admin');
    console.log('✅ Đã tạo tài khoản Demo mặc định: admin@boclink.vn / 123456');
  }
} catch (e) {
  console.error('Lỗi kiểm tra user mặc định:', e);
}

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets (không tự động serve index.html để kiểm soát đăng nhập)
app.use(express.static(publicDir, { index: false }));

// Frontend Page Routes - Cá nhân: Không đăng nhập thì chuyển về /user/login
app.get('/', optionalAuth, (req: AuthRequest, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/user/login');
});

app.get(['/user', '/user/login'], (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

// Khóa trang đăng ký, chuyển hướng về đăng nhập
app.get('/user/register', (req, res) => {
  res.redirect('/user/login');
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});

// API Auth Routes
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/logout', authController.logout);
app.get('/api/auth/me', optionalAuth, authController.getMe);

// API Link & Analytics Routes (Chỉ cho phép khi đã đăng nhập)
app.post('/api/links/shorten', requireAuth, linkController.shorten);
app.get('/api/links', requireAuth, linkController.getMyLinks);
app.get('/api/links/dashboard/overview', requireAuth, linkController.getDashboardOverview);
app.get('/api/links/recent-clicks', requireAuth, linkController.getRecentClicks);
app.get('/api/realtime/stream', optionalAuth, (req: AuthRequest, res) => {
  registerRealtimeClient(res, req.user?.id);
});
app.get('/api/links/:id/analytics', requireAuth, linkController.getLinkAnalytics);
app.put('/api/links/:id', requireAuth, linkController.updateLink);
app.delete('/api/links/:id', requireAuth, linkController.deleteLink);

// API Custom Domain Routes
app.get('/api/domains', optionalAuth, domainController.getDomains);
app.post('/api/domains', requireAuth, domainController.addDomain);
app.delete('/api/domains/:id', requireAuth, domainController.deleteDomain);

// API Backup Database (Tải file database về máy)
app.get('/api/system/backup-db', requireAuth, (req, res) => {
  try {
    db.pragma('wal_checkpoint(FULL)');
  } catch (e) {
    console.error('WAL checkpoint error:', e);
  }
  const dbFile = path.resolve(__dirname, '../data/boclink.sqlite');
  res.download(dbFile, 'boclink-backup.sqlite');
});


// Dynamic Redirect Route (:slug) - Cần đặt ở cuối cùng
app.get('/:slug', redirectController.handleRedirect);
app.post('/:slug', redirectController.handleRedirect);

app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`🚀 BoclinkVN Clone Server đang chạy tại:`);
  console.log(`👉 Trang chủ:   http://localhost:${config.port}`);
  console.log(`👉 Đăng nhập:   http://localhost:${config.port}/user`);
  console.log(`👉 Dashboard:   http://localhost:${config.port}/dashboard`);
  console.log(`🔑 Tài khoản Demo: admin@boclink.vn | Mật khẩu: 123456`);
  console.log(`====================================================`);
});
