import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { hashPassword, comparePassword, generateToken, AuthRequest } from '../utils/auth.js';

export const authController = {
  // Đăng ký tài khoản
  register: (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
      }

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return res.status(400).json({ error: 'Email này đã được đăng ký' });
      }

      const hashedPassword = hashPassword(password);
      const userName = name || email.split('@')[0];

      const stmt = db.prepare(`
        INSERT INTO users (email, password, name)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(email, hashedPassword, userName);
      const userId = Number(result.lastInsertRowid);

      const user = { id: userId, email, name: userName, role: 'user' };
      const token = generateToken(user);

      res.cookie('token', token, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });

      return res.status(201).json({
        message: 'Đăng ký thành công',
        user,
        token
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi đăng ký tài khoản' });
    }
  },

  // Đăng nhập
  login: (req: Request, res: Response) => {
    try {
      const { email, password, rememberme } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin đăng nhập' });
      }

      const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác' });
      }

      const isMatch = comparePassword(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác' });
      }

      const authUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };
      const token = generateToken(authUser);

      res.cookie('token', token, {
        httpOnly: true,
        maxAge: rememberme ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });

      return res.json({
        message: 'Đăng nhập thành công',
        user: authUser,
        token
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi xử lý đăng nhập' });
    }
  },

  // Đăng xuất
  logout: (req: Request, res: Response) => {
    res.clearCookie('token');
    return res.json({ message: 'Đã đăng xuất' });
  },

  // Lấy thông tin user hiện tại
  getMe: (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }
    return res.json({ user: req.user });
  }
};
