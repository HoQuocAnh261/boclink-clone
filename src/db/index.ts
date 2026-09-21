import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'boclink.sqlite');
export const db = new Database(dbPath);

// Bật chế độ WAL giúp SQLite chạy nhanh và hỗ trợ đồng thời cao
db.pragma('journal_mode = WAL');

// Khởi tạo các bảng
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NULL,
      title TEXT,
      original_url TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'direct', -- 'direct', 'cloak', 'deeplink'
      domain TEXT NULL,           -- Tên miền tùy chỉnh (ví dụ: phim24h.online)
      password TEXT NULL,
      clicks INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NULL,
      domain TEXT UNIQUE NOT NULL,
      is_default INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL,
      ip TEXT,
      referrer TEXT,
      browser TEXT,
      os TEXT,
      device TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
    CREATE INDEX IF NOT EXISTS idx_links_user ON links(user_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_link ON clicks(link_id);
  `);

  // Thêm cột domain vào bảng links nếu trước đó chưa có
  try {
    db.exec(`ALTER TABLE links ADD COLUMN domain TEXT NULL;`);
  } catch (e) {}

  // Khởi tạo danh sách các domain mẫu phù hợp cho dân Affiliate (như phim24h.online...)
  try {
    const defaultDomains = [
      'phim24h.online',
      'reviewdeal.online',
      'dealhot.link',
      'linkvip.me',
      'boclink.vn'
    ];
    for (const d of defaultDomains) {
      db.prepare(`
        INSERT OR IGNORE INTO domains (domain, is_default, status)
        VALUES (?, 1, 'active')
      `).run(d);
    }
  } catch (e) {}
}
