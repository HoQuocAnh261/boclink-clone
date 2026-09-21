import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function hashPassword(plainText: string): string {
  return bcrypt.hashSync(plainText, 10);
}

export function comparePassword(plainText: string, hashed: string): boolean {
  return bcrypt.compareSync(plainText, hashed);
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthUser;
  } catch {
    return null;
  }
}

// Middleware bắt buộc phải đăng nhập
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    if (req.headers.accept?.includes('text/html')) {
      return res.redirect('/user/login');
    }
    return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục' });
  }

  const user = verifyToken(token);
  if (!user) {
    if (req.headers.accept?.includes('text/html')) {
      return res.redirect('/user/login');
    }
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' });
  }

  req.user = user;
  next();
}

// Middleware tùy chọn (nếu có token thì gắn user, không có thì vẫn cho qua)
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}
