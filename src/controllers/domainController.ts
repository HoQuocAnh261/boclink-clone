import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { AuthRequest } from '../utils/auth.js';

export const domainController = {
  // Lấy danh sách tất cả các domain khả dụng
  getDomains: (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user ? req.user.id : null;

      let domains: any[];
      if (userId) {
        domains = db.prepare(`
          SELECT * FROM domains 
          WHERE is_default = 1 OR user_id = ?
          ORDER BY is_default DESC, created_at DESC
        `).all(userId);
      } else {
        domains = db.prepare(`
          SELECT * FROM domains 
          WHERE is_default = 1
          ORDER BY created_at ASC
        `).all();
      }

      return res.json({ domains });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi lấy danh sách domain' });
    }
  },

  // Thêm domain tùy chỉnh mới
  addDomain: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập để thêm tên miền' });
      }

      let { domain } = req.body;
      if (!domain) {
        return res.status(400).json({ error: 'Tên miền không được để trống' });
      }

      // Làm sạch tên miền (bỏ https://, http://, dấu gạch chéo cuối)
      domain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

      // Kiểm tra định dạng domain
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
        return res.status(400).json({ error: 'Định dạng tên miền không hợp lệ (Ví dụ: phim24h.online)' });
      }

      const existing = db.prepare('SELECT id FROM domains WHERE domain = ?').get(domain);
      if (existing) {
        return res.status(400).json({ error: 'Tên miền này đã tồn tại trong hệ thống' });
      }

      const stmt = db.prepare(`
        INSERT INTO domains (user_id, domain, is_default, status)
        VALUES (?, ?, 0, 'active')
      `);
      const result = stmt.run(req.user.id, domain);

      return res.status(201).json({
        message: 'Thêm tên miền thành công',
        domain: {
          id: Number(result.lastInsertRowid),
          domain,
          user_id: req.user.id,
          status: 'active'
        }
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi thêm tên miền' });
    }
  },

  // Xóa domain của user
  deleteDomain: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
      }

      const domainId = req.params.id;
      const domain: any = db.prepare('SELECT * FROM domains WHERE id = ?').get(domainId);

      if (!domain) {
        return res.status(404).json({ error: 'Không tìm thấy tên miền' });
      }

      if (domain.is_default === 1 && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Không thể xóa tên miền mặc định của hệ thống' });
      }

      if (domain.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Bạn không có quyền xóa tên miền này' });
      }

      db.prepare('DELETE FROM domains WHERE id = ?').run(domainId);
      return res.json({ message: 'Đã xóa tên miền' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi xóa tên miền' });
    }
  }
};
