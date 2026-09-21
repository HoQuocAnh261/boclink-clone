import { Request } from 'express';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'boclink_super_secret_jwt_key_2026',
  baseUrl: process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000',
  
  // Tự động nhận diện domain trực tiếp từ request (Render/Cloudflare/Custom domain)
  getBaseUrl: (req?: Request): string => {
    if (process.env.BASE_URL) return process.env.BASE_URL;
    if (req) {
      const host = req.get('host');
      const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
      if (host) return `${proto}://${host}`;
    }
    return process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
  }
};
