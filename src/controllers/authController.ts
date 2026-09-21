import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { hashPassword, comparePassword, generateToken, AuthRequest } from '../utils/auth.js';

export const authController = {
  // Đăng ký tài khoản (Đã khóa - Chỉ dùng cho cá nhân)
  register: (req: Request, res: Response) => {
    return res.status(403).json({ 
      error: 'Chức năng đăng ký đã bị khóa. Hệ thống chỉ sử dụng cho cá nhân quản trị viên.' 
    });
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
