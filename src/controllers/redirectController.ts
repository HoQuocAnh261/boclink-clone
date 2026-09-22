import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { parseDeeplink } from '../utils/deeplink.js';
import { isCrawlerBot, parseDeviceInfo, getGeoLocation } from '../utils/deviceParser.js';
import { broadcastNewClick } from '../utils/realtime.js';

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
  handleRedirect: async (req: Request, res: Response) => {
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
      // Trả về thẻ OpenGraph HTML để Facebook/Zalo/Telegram ghim đích đến là mozphim.online
      // TUYỆT ĐỐI KHÔNG TÍNH CLICK CHO BOT!
      if (isBot) {
        const ogTitle = link.og_title || link.title || 'Mở trên ứng dụng';
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


      // 2. NGƯỜI DÙNG THẬT TRUY CẬP:
      // Phân tích IP chuẩn (hỗ trợ qua Cloudflare proxy / Render)
      const rawIp = (
        (req.headers['cf-connecting-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1'
      );
      let clientIp = rawIp.trim();
      if (clientIp === '::1' || clientIp === '127.0.0.1') {
        clientIp = '127.0.0.1';
      } else if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.replace('::ffff:', '');
      }

      const rawReferrer = req.get('referrer') || req.get('referer') || 'Direct';
      let cleanReferrer = 'Direct';
      try {
        if (rawReferrer !== 'Direct') {
          cleanReferrer = new URL(rawReferrer).hostname;
        }
      } catch {
        cleanReferrer = rawReferrer;
      }

      // Lấy thông tin vị trí địa lý, Cloudflare headers & ngôn ngữ thiết bị (hỗ trợ iPhone iCloud Relay / 4G)
      const cfCountry = req.headers['cf-ipcountry'] as string | undefined;
      const cfCity = req.headers['cf-ipcity'] as string | undefined;
      const acceptLang = req.headers['accept-language'] as string | undefined;
      const geoInfo = await getGeoLocation(clientIp, cfCountry, cfCity, acceptLang);

      // YÊU CẦU: LOẠI TRỪ CÁC CLICK TỪ QUỐC GIA KHÁC VIỆT NAM
      // Nếu KHÔNG phải từ Việt Nam -> Tuyệt đối không tính click (nhưng vẫn redirect cho người dùng)
      if (geoInfo.isVietnam) {
        // Phân tích thông tin Thiết bị, Hệ điều hành, App/Trình duyệt
        const devInfo = parseDeviceInfo(userAgentRaw);

        // YÊU CẦU: ĐÃ BỎ GIỚI HẠN 1 CLICK/IP/NGÀY
        // Mỗi lượt click của người dùng đều được tính đầy đủ (có debounce 3s chống duplicate do trình duyệt prefetch)
        try {
          const duplicateClick = db.prepare(`
            SELECT id FROM clicks
            WHERE link_id = ? 
              AND ip = ? 
              AND created_at >= DATETIME('now', '-3 seconds')
            LIMIT 1
          `).get(link.id, clientIp);

          if (!duplicateClick) {
            const insertResult = db.prepare(`
              INSERT INTO clicks (link_id, ip, referrer, browser, os, device, device_type, country, city)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(link.id, clientIp, cleanReferrer, devInfo.browser, devInfo.os, devInfo.device, devInfo.deviceType, geoInfo.country, geoInfo.city);

            db.prepare('UPDATE links SET clicks = clicks + 1 WHERE id = ?').run(link.id);

            // Bắn tín hiệu Realtime tức thì (0ms) tới giao diện Dashboard
            try {
              const now = new Date();
              const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }) + ' ' + now.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
              broadcastNewClick({
                id: Number(insertResult.lastInsertRowid),
                link_id: link.id,
                slug: link.slug,
                link_title: link.title || link.slug,
                domain: link.domain || 'mozphim.online',
                ip: clientIp,
                referrer: cleanReferrer,
                browser: devInfo.browser,
                os: devInfo.os,
                device: devInfo.device,
                device_type: devInfo.deviceType,
                city: geoInfo.city,
                country: geoInfo.country,
                created_at: now.toISOString(),
                click_time: timeStr,
                is_onsite_3m: true
              });
            } catch (broadcastErr) {
              console.error('Realtime broadcast error:', broadcastErr);
            }
          }
        } catch (err) {
          console.error('Error logging real click:', err);
        }
      }


      // 1. Chế độ Cloak / Bọc link (Ẩn nguồn, chống chặn link mạng xã hội)
      if (link.type === 'cloak') {
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
      }

      // 2. Chế độ Smart Deeplink cho ứng dụng di động (TikTok, Shopee, Lazada, YouTube)
      const deeplink = parseDeeplink(destination);
      const isMobile = /mobile|iphone|ipod|ipad|android/i.test(userAgentRaw);

      // Nếu người dùng truy cập từ điện thoại di động và đích đến là TikTok/Shopee/Lazada (hoặc type là deeplink)
      if (isMobile && (deeplink.isDeeplinkable || link.type === 'deeplink')) {
        const ogTitle = link.og_title || link.title || `Mở trên ứng dụng ${deeplink.platform}`;
        const ogDesc = link.og_description || 'Bấm để xem chi tiết sản phẩm và ưu đãi trên ứng dụng.';
        const ogImg = link.og_image || '';
        const shortUrl = link.domain ? `https://${link.domain}/${link.slug}` : `https://${req.get('host')}/${link.slug}`;

        return res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="description" content="${escapeHtml(ogDesc)}">

  <!-- OpenGraph cho Facebook / Zalo -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(shortUrl)}">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDesc)}">
  ${ogImg ? `<meta property="og:image" content="${escapeHtml(ogImg)}">` : ''}

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b101b;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
      user-select: none;
      -webkit-user-select: none;
    }
    .card {
      width: 100%;
      max-width: 380px;
      background: #131b2e;
      border: 1px solid rgba(51, 65, 85, 0.7);
      border-radius: 24px;
      padding: 24px;
      text-align: center;
      box-shadow: 0 20px 35px -10px rgba(0, 0, 0, 0.5);
    }
    .spinner-box {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      border-radius: 50%;
      background: linear-gradient(135deg, #06557c, #32af5e);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      box-shadow: 0 8px 20px rgba(50, 175, 94, 0.3);
      animation: bounce 1.5s infinite;
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    h2 {
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
    }
    p.desc {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 20px;
      line-height: 1.4;
    }
    .btn-app {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px 16px;
      background: linear-gradient(90deg, #06557c, #32af5e);
      color: #ffffff;
      font-weight: 700;
      font-size: 15px;
      border-radius: 16px;
      text-decoration: none;
      box-shadow: 0 8px 20px rgba(6, 85, 124, 0.35);
      transition: opacity 0.2s, transform 0.1s;
      animation: pulse 2s infinite;
    }
    .btn-app:active {
      transform: scale(0.97);
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(50, 175, 94, 0.4); }
      50% { box-shadow: 0 0 0 10px rgba(50, 175, 94, 0); }
    }
    .btn-web {
      display: block;
      width: 100%;
      margin-top: 10px;
      padding: 12px 16px;
      background: rgba(30, 41, 59, 0.8);
      color: #cbd5e1;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid rgba(51, 65, 85, 0.8);
      border-radius: 14px;
      text-decoration: none;
    }
    .tip-box {
      margin-top: 16px;
      padding: 12px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.25);
      border-radius: 14px;
      color: #93c5fd;
      font-size: 11px;
      text-align: left;
      line-height: 1.4;
    }
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid rgba(51, 65, 85, 0.4);
      font-size: 10px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner-box">
      ${deeplink.platform.includes('TikTok') ? '🎵' : (deeplink.platform.includes('Shopee') ? '🛍️' : '🚀')}
    </div>
    <h2>Đang mở App ${escapeHtml(deeplink.platform)}...</h2>
    <p class="desc">
      Đang tự động chuyển hướng vào ứng dụng <b style="color: #38bdf8;">${escapeHtml(deeplink.platform)}</b> trên thiết bị của bạn.
    </p>

    <a id="btnOpenApp" href="#" class="btn-app">
      <span>MỞ TRONG APP ${escapeHtml(deeplink.platform).toUpperCase()}</span>
      <span>➔</span>
    </a>

    <a id="btnWebFallback" href="${escapeHtml(destination)}" class="btn-web">
      Tiếp tục xem trên Web
    </a>

    <div id="inAppTip" class="tip-box" style="display: none;">
      💡 <b>Mẹo:</b> Nếu Facebook chặn mở App, hãy bấm nút <b>"MỞ TRONG APP"</b> ở trên hoặc bấm dấu <b>•••</b> góc trên bên phải chọn <b>"Mở trong trình duyệt"</b>.
    </div>

    <div class="footer">
      Bảo vệ bởi BoclinkVN Smart Deeplink
    </div>
  </div>

  <script>
    (function() {
      var iosScheme = ${JSON.stringify(deeplink.iosScheme || null)};
      var iosAltScheme = ${JSON.stringify(deeplink.iosAltScheme || null)};
      var androidIntent = ${JSON.stringify(deeplink.androidIntent || null)};
      var androidScheme = ${JSON.stringify(deeplink.androidScheme || null)};
      var webUrl = ${JSON.stringify(destination)};

      var ua = navigator.userAgent || '';
      var isIOS = /iPhone|iPad|iPod/i.test(ua);
      var isAndroid = /Android/i.test(ua);
      var isInApp = /FBAN|FBIOS|FB4A|FB_IAB|Zalo|Instagram/i.test(ua);

      var targetScheme = webUrl;
      if (isIOS) {
        targetScheme = iosScheme || iosAltScheme || webUrl;
      } else if (isAndroid) {
        targetScheme = androidIntent || androidScheme || webUrl;
      }

      var btn = document.getElementById('btnOpenApp');
      if (btn) btn.href = targetScheme;

      if (isInApp) {
        var tip = document.getElementById('inAppTip');
        if (tip) tip.style.display = 'block';
      }

      function tryOpen() {
        if (isAndroid) {
          window.location.href = targetScheme;
          setTimeout(function() {
            if (!document.hidden && androidScheme && androidScheme !== targetScheme) {
              window.location.href = androidScheme;
            }
          }, 600);
        } else if (isIOS) {
          window.location.href = targetScheme;
          setTimeout(function() {
            if (iosAltScheme && !document.hidden) {
              window.location.href = iosAltScheme;
            }
          }, 600);
        }
      }

      // Kích hoạt ngay
      tryOpen();
    })();
  </script>
</body>
</html>`);
      }

      // 3. Chuyển hướng trực tiếp 302 (Áp dụng cho Desktop hoặc các link web thông thường)
      res.writeHead(302, {
        'Location': destination,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Content-Length': '0'
      });
      return res.end();
    } catch (error: any) {
      return res.status(500).send('Lỗi chuyển hướng liên kết');
    }
  }
};
