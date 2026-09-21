import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { parseDeeplink } from '../utils/deeplink.js';
import { isCrawlerBot, parseDeviceInfo, getGeoLocation } from '../utils/deviceParser.js';

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const redirectController = {
  handleRedirect: (req: Request, res: Response) => {
    try {
      const slug = String(req.params.slug);

      // Bỏ qua các đường dẫn hệ thống
      if (['api', 'user', 'dashboard', 'static', 'favicon.ico', 'health'].includes(slug)) {
        return res.status(404).send('Not found');
      }

      const link: any = db.prepare('SELECT * FROM links WHERE slug = ?').get(slug);

      if (!link) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Liên kết không tồn tại - Boclink</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-slate-900 text-slate-100 flex items-center justify-center min-h-screen p-4">
            <div class="max-w-md w-full text-center bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur">
              <div class="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">!</div>
              <h1 class="text-2xl font-bold mb-2">404 - Không tìm thấy liên kết</h1>
              <p class="text-slate-400 text-sm mb-6">Đường link bạn vừa truy cập không tồn tại hoặc đã bị xóa bởi chủ sở hữu.</p>
              <a href="/" class="inline-block px-6 py-2.5 bg-gradient-to-r from-[#06557c] to-[#32af5e] text-white font-medium rounded-xl hover:opacity-90 transition">Về trang chủ</a>
            </div>
          </body>
          </html>
        `);
      }

      if (!link.is_active) {
        return res.status(410).send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Liên kết tạm khóa - Boclink</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-slate-900 text-slate-100 flex items-center justify-center min-h-screen p-4">
            <div class="max-w-md w-full text-center bg-slate-800/80 p-8 rounded-2xl border border-slate-700 shadow-2xl">
              <h1 class="text-2xl font-bold mb-2">Liên kết đang tạm khóa</h1>
              <p class="text-slate-400 text-sm mb-6">Liên kết này hiện đang bị tạm dừng hoạt động.</p>
              <a href="/" class="inline-block px-6 py-2.5 bg-gradient-to-r from-[#06557c] to-[#32af5e] text-white font-medium rounded-xl">Về trang chủ</a>
            </div>
          </body>
          </html>
        `);
      }

      // Kiểm tra mật khẩu nếu link được cài đặt bảo vệ bằng mật khẩu
      if (link.password) {
        const providedPassword = req.query.pwd || req.body?.password;
        if (!providedPassword || providedPassword !== link.password) {
          return res.send(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Mật khẩu bảo vệ - Boclink</title>
              <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-slate-900 text-slate-100 flex items-center justify-center min-h-screen p-4">
              <div class="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
                <div class="text-center mb-6">
                  <div class="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">🔒</div>
                  <h1 class="text-xl font-bold">Liên kết được bảo vệ</h1>
                  <p class="text-slate-400 text-xs mt-1">Vui lòng nhập mật khẩu để tiếp tục truy cập</p>
                </div>
                ${providedPassword ? '<div class="p-3 mb-4 text-xs bg-red-500/20 text-red-300 rounded-lg text-center">Mật khẩu không chính xác!</div>' : ''}
                <form method="POST" action="/${link.slug}">
                  <input type="password" name="password" placeholder="Nhập mật khẩu..." required
                         class="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 mb-4">
                  <button type="submit" class="w-full py-3 bg-gradient-to-r from-[#06557c] to-[#32af5e] text-white font-medium rounded-xl hover:opacity-90 transition">
                    Xác nhận
                  </button>
                </form>
              </div>
            </body>
            </html>
          `);
        }
      }

      const userAgentRaw = req.headers['user-agent'] || '';
      const destination = link.original_url;
      const isBot = isCrawlerBot(userAgentRaw);

      // 1. NẾU LÀ BOT QUÉT LINK (Facebook Crawler, Zalo Bot, Googlebot...):
      // TUYỆT ĐỐI KHÔNG TÍNH CLICK!
      if (isBot) {
        // Nếu có tùy chỉnh preview -> Trả về thẻ OpenGraph HTML để Facebook/Zalo hiển thị đúng poster & tiêu đề
        if (link.og_title || link.og_image) {
          const ogTitle = link.og_title || link.title || 'Ưu đãi hấp dẫn';
          const ogDesc = link.og_description || 'Bấm để xem chi tiết sản phẩm và ưu đãi trên ứng dụng.';
          const ogImg = link.og_image || '';
          const shortUrl = link.domain ? `https://${link.domain}/${link.slug}` : `https://${req.get('host')}/${link.slug}`;

          return res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="description" content="${escapeHtml(ogDesc)}">
  
  <!-- OpenGraph / Facebook / Zalo -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(shortUrl)}">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDesc)}">
  ${ogImg ? `<meta property="og:image" content="${escapeHtml(ogImg)}">
  <meta property="og:image:secure_url" content="${escapeHtml(ogImg)}">` : ''}
  <meta property="og:site_name" content="${escapeHtml(link.domain || req.get('host') || 'mozphim.online')}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(shortUrl)}">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDesc)}">
  ${ogImg ? `<meta name="twitter:image" content="${escapeHtml(ogImg)}">` : ''}
</head>
<body>
  <h1>${escapeHtml(ogTitle)}</h1>
  <p>${escapeHtml(ogDesc)}</p>
  ${ogImg ? `<img src="${escapeHtml(ogImg)}" alt="${escapeHtml(ogTitle)}">` : ''}
  <script>
    window.location.replace(${JSON.stringify(destination)});
  </script>
</body>
</html>`);
        }

        // Nếu không tùy chỉnh preview -> Trả mã 302 trực tiếp để Facebook nhận diện là link TikTok/Shopee gốc
        res.writeHead(302, {
          'Location': destination,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Content-Length': '0'
        });
        return res.end();
      }

      // 2. NGƯỜI DÙNG THẬT TRUY CẬP:
      // Phân tích IP chuẩn (hỗ trợ qua Cloudflare proxy / Render)
      const rawIp = (
        (req.headers['cf-connecting-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1'
      );
      const clientIp = rawIp.replace(/^.*:/, '') === '1' ? '127.0.0.1' : rawIp.replace(/^::ffff:/, '');

      const rawReferrer = req.get('referrer') || req.get('referer') || 'Direct';
      let cleanReferrer = 'Direct';
      try {
        if (rawReferrer !== 'Direct') {
          cleanReferrer = new URL(rawReferrer).hostname;
        }
      } catch {
        cleanReferrer = rawReferrer;
      }

      // Lấy thông tin vị trí địa lý & Cloudflare headers
      const cfCountry = req.headers['cf-ipcountry'] as string | undefined;
      const cfCity = req.headers['cf-ipcity'] as string | undefined;
      const geoInfo = getGeoLocation(clientIp, cfCountry, cfCity);

      // YÊU CẦU: LOẠI TRỪ CÁC CLICK TỪ QUỐC GIA KHÁC VIỆT NAM
      // Nếu KHÔNG phải từ Việt Nam -> Tuyệt đối không tính click (nhưng vẫn redirect cho người dùng)
      if (geoInfo.isVietnam) {
        // Phân tích thông tin Thiết bị, Hệ điều hành, App/Trình duyệt
        const devInfo = parseDeviceInfo(userAgentRaw);

        // Mỗi ngày chỉ tính 1 click cho cùng 1 địa chỉ IP truy cập (theo ngày giờ Việt Nam GMT+7)
        try {
          const todayClick = db.prepare(`
            SELECT id FROM clicks
            WHERE link_id = ? 
              AND ip = ? 
              AND DATE(created_at, '+7 hours') = DATE('now', '+7 hours')
            LIMIT 1
          `).get(link.id, clientIp);

          if (!todayClick) {
            // IP này chưa click hôm nay -> Ghi nhận 1 lượt click người dùng thật từ Việt Nam
            db.prepare(`
              INSERT INTO clicks (link_id, ip, referrer, browser, os, device, device_type, country, city)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(link.id, clientIp, cleanReferrer, devInfo.browser, devInfo.os, devInfo.device, devInfo.deviceType, geoInfo.country, geoInfo.city);

            db.prepare('UPDATE links SET clicks = clicks + 1 WHERE id = ?').run(link.id);
          }
        } catch (err) {
          console.error('Error logging real click:', err);
        }
      }


      // 1. Chuyển hướng trực tiếp chuẩn như phim24h.online (Clean 302 Found, Content-Length: 0, no-cache)
      // Cho phép Facebook In-App Browser nhận lệnh chuyển hướng ngay lập tức và bung thẳng vào App TikTok/Shopee
      if (link.type === 'direct' || link.type === 'deeplink') {
        res.writeHead(302, {
          'Location': destination,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Content-Length': '0'
        });
        return res.end();
      }

      // 3. Chế độ Cloak / Bọc link (Ẩn nguồn, chống chặn link mạng xã hội)
      return res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="referrer" content="no-referrer">
          <title>Đang chuyển hướng an toàn...</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-[#0b101b] text-slate-100 flex flex-col items-center justify-center min-h-screen p-4 font-sans">
          <div class="max-w-md w-full bg-[#131b2e] border border-slate-700/60 rounded-3xl p-8 text-center shadow-2xl">
            <div class="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <div class="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
              <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-[#06557c] to-[#32af5e] flex items-center justify-center text-white text-xl">
                🛡️
              </div>
            </div>

            <h2 class="text-xl font-bold mb-2">Đang kết nối an toàn</h2>
            <p class="text-slate-400 text-xs mb-6">Đang chuyển tiếp tới trang đích trong giây lát...</p>

            <a href="${destination}" rel="noreferrer" class="block w-full py-3 px-4 bg-gradient-to-r from-[#06557c] to-[#32af5e] text-white font-medium rounded-2xl shadow-lg hover:opacity-95 transition">
              Bấm vào đây nếu không tự chuyển hướng
            </a>

            <div class="mt-8 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
              Được bảo vệ bởi <span class="text-emerald-400 font-semibold">BoclinkVN Cloaker</span>
            </div>
          </div>

          <script>
            setTimeout(function() {
              window.location.replace(${JSON.stringify(destination)});
            }, 800);
          </script>
        </body>
        </html>
      `);
    } catch (error: any) {
      return res.status(500).send('Lỗi chuyển hướng liên kết');
    }
  }
};
