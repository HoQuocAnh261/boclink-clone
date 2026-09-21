import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { AuthRequest } from '../utils/auth.js';
import { config } from '../config.js';
import QRCode from 'qrcode';

// Hàm sinh slug ngẫu nhiên 6 ký tự
function generateRandomSlug(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const linkController = {
  // Rút gọn link (chỉ cho phép user đã đăng nhập)
  shorten: async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Hệ thống cá nhân: Vui lòng đăng nhập để tạo liên kết' });
      }

      let { url, custom_slug, type, title, password, domain, og_title, og_description, og_image } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'Vui lòng cung cấp đường dẫn URL hợp lệ' });
      }

      // Đảm bảo URL có protocol http:// hoặc https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Xác thực URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Định dạng URL không đúng' });
      }

      // Xử lý slug
      let slug = (custom_slug || '').trim();
      if (slug) {
        // Kiểm tra ký tự hợp lệ cho slug: chữ, số, dấu gạch ngang
        if (!/^[a-zA-Z0-9-_]+$/.test(slug)) {
          return res.status(400).json({ error: 'Bí danh tùy chỉnh chỉ được chứa chữ, số, dấu gạch ngang (-) và gạch dưới (_)' });
        }
        // Kiểm tra trùng
        const existing = db.prepare('SELECT id FROM links WHERE slug = ?').get(slug);
        if (existing) {
          return res.status(400).json({ error: 'Bí danh này đã tồn tại, vui lòng chọn tên khác' });
        }
      } else {
        // Sinh slug ngẫu nhiên không trùng
        let attempts = 0;
        do {
          slug = generateRandomSlug(6);
          const found = db.prepare('SELECT id FROM links WHERE slug = ?').get(slug);
          if (!found) break;
          attempts++;
        } while (attempts < 10);
      }

      const linkType = ['direct', 'cloak', 'deeplink'].includes(type) ? type : 'direct';
      const userId = req.user ? req.user.id : null;
      const linkTitle = title ? title.trim() : (new URL(url)).hostname;
      const selectedDomain = domain ? domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null;

      const stmt = db.prepare(`
        INSERT INTO links (user_id, title, original_url, slug, type, password, domain, og_title, og_description, og_image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(userId, linkTitle, url, slug, linkType, password || null, selectedDomain, og_title || null, og_description || null, og_image || null);
      const linkId = Number(result.lastInsertRowid);

      const baseUrl = config.getBaseUrl(req);
      const shortUrl = selectedDomain ? `https://${selectedDomain}/${slug}` : `${baseUrl}/${slug}`;
      const qrCodeDataUrl = await QRCode.toDataURL(shortUrl, { width: 250, margin: 2 });

      return res.status(201).json({
        message: 'Tạo link rút gọn thành công',
        link: {
          id: linkId,
          title: linkTitle,
          original_url: url,
          slug,
          type: linkType,
          domain: selectedDomain,
          og_title: og_title || null,
          og_description: og_description || null,
          og_image: og_image || null,
          short_url: shortUrl,
          qr_code: qrCodeDataUrl,
          created_at: new Date().toISOString()
        }
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi rút gọn link' });
    }
  },

  // Lấy danh sách link của user hiện tại
  getMyLinks: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
      }

      const links = db.prepare(`
        SELECT 
          l.*,
          (SELECT COUNT(*) FROM clicks c WHERE c.link_id = l.id AND DATE(c.created_at) = DATE('now')) AS clicks_today
        FROM links l
        WHERE l.user_id = ?
        ORDER BY l.created_at DESC
      `).all(req.user.id);

      const baseUrl = config.getBaseUrl(req);
      const mapped = (links as any[]).map(link => ({
        ...link,
        short_url: link.domain ? `https://${link.domain}/${link.slug}` : `${baseUrl}/${link.slug}`
      }));

      return res.json({ links: mapped });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi tải danh sách link' });
    }
  },

  // Xem analytics chi tiết của 1 link
  getLinkAnalytics: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
      }

      const linkId = req.params.id;
      const link: any = db.prepare('SELECT * FROM links WHERE id = ? AND user_id = ?').get(linkId, req.user.id);

      if (!link) {
        return res.status(404).json({ error: 'Không tìm thấy link hoặc không có quyền xem' });
      }

      // Thống kê theo ngày (7 ngày gần nhất)
      const dailyClicks = db.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM clicks
        WHERE link_id = ? AND created_at >= DATE('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).all(linkId);

      // Thống kê theo thiết bị
      const devices = db.prepare(`
        SELECT device, COUNT(*) as count
        FROM clicks
        WHERE link_id = ?
        GROUP BY device
        ORDER BY count DESC
      `).all(linkId);

      // Thống kê theo nguồn truy cập (referrer)
      const referrers = db.prepare(`
        SELECT referrer, COUNT(*) as count
        FROM clicks
        WHERE link_id = ?
        GROUP BY referrer
        ORDER BY count DESC
        LIMIT 10
      `).all(linkId);

      // Thống kê theo hệ điều hành (OS)
      const osList = db.prepare(`
        SELECT os, COUNT(*) as count
        FROM clicks
        WHERE link_id = ?
        GROUP BY os
        ORDER BY count DESC
      `).all(linkId);

      const baseUrl = config.getBaseUrl(req);
      return res.json({
        link: {
          ...link,
          short_url: link.domain ? `https://${link.domain}/${link.slug}` : `${baseUrl}/${link.slug}`
        },
        analytics: {
          dailyClicks,
          devices,
          referrers,
          osList
        }
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi lấy thống kê link' });
    }
  },

  // Cập nhật link
  updateLink: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
      }

      const linkId = req.params.id;
      const { title, original_url, type, is_active, domain, og_title, og_description, og_image } = req.body;

      const link = db.prepare('SELECT id FROM links WHERE id = ? AND user_id = ?').get(linkId, req.user.id);
      if (!link) {
        return res.status(404).json({ error: 'Không tìm thấy link' });
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      if (original_url !== undefined) {
        updates.push('original_url = ?');
        params.push(original_url);
      }
      if (type !== undefined && ['direct', 'cloak', 'deeplink'].includes(type)) {
        updates.push('type = ?');
        params.push(type);
      }
      if (domain !== undefined) {
        updates.push('domain = ?');
        params.push(domain ? domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null);
      }
      if (og_title !== undefined) {
        updates.push('og_title = ?');
        params.push(og_title ? og_title.trim() : null);
      }
      if (og_description !== undefined) {
        updates.push('og_description = ?');
        params.push(og_description ? og_description.trim() : null);
      }
      if (og_image !== undefined) {
        updates.push('og_image = ?');
        params.push(og_image ? og_image.trim() : null);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active ? 1 : 0);
      }

      if (updates.length > 0) {
        params.push(linkId);
        db.prepare(`UPDATE links SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      return res.json({ message: 'Cập nhật link thành công' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi cập nhật link' });
    }
  },

  // Xóa link
  deleteLink: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
      }

      const linkId = req.params.id;
      const result = db.prepare('DELETE FROM links WHERE id = ? AND user_id = ?').run(linkId, req.user.id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Không tìm thấy link cần xóa' });
      }

      return res.json({ message: 'Đã xóa link' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi xóa link' });
    }
  },

  // Lấy tổng quan thống kê cho Dashboard người dùng
  getDashboardOverview: (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
      }

      const totalLinks: any = db.prepare('SELECT COUNT(*) as count FROM links WHERE user_id = ?').get(req.user.id);
      const totalClicks: any = db.prepare(`
        SELECT COALESCE(SUM(clicks), 0) as count FROM links WHERE user_id = ?
      `).get(req.user.id);

      const todayClicks: any = db.prepare(`
        SELECT COUNT(*) as count 
        FROM clicks c 
        JOIN links l ON c.link_id = l.id 
        WHERE l.user_id = ? AND DATE(c.created_at) = DATE('now')
      `).get(req.user.id);

      return res.json({
        totalLinks: totalLinks.count,
        totalClicks: totalClicks.count,
        todayClicks: todayClicks.count
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi tải tổng quan' });
    }
  }
};
