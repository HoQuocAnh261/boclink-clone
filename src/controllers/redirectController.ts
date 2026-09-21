import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { UAParser } from 'ua-parser-js';
import { parseDeeplink } from '../utils/deeplink.js';

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

      // Ghi nhận lượt click & phân tích thông tin
      const parser = new UAParser(req.headers['user-agent']);
      const uaResult = parser.getResult();
      const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
      const rawReferrer = req.get('referrer') || req.get('referer') || 'Direct';
      
      let cleanReferrer = 'Direct';
      try {
        if (rawReferrer !== 'Direct') {
          cleanReferrer = new URL(rawReferrer).hostname;
        }
      } catch {
        cleanReferrer = rawReferrer;
      }

      const browser = uaResult.browser.name || 'Unknown';
      const os = uaResult.os.name || 'Unknown';
      const deviceType = uaResult.device.type || 'Desktop';

      // Cập nhật database
      try {
        db.prepare(`
          INSERT INTO clicks (link_id, ip, referrer, browser, os, device)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(link.id, ip, cleanReferrer, browser, os, deviceType);

        db.prepare('UPDATE links SET clicks = clicks + 1 WHERE id = ?').run(link.id);
      } catch (err) {
        console.error('Error logging click:', err);
      }

      const destination = link.original_url;

      // 1. Chuyển hướng trực tiếp (Direct 302)
      if (link.type === 'direct') {
        return res.redirect(302, destination);
      }

      // 2. Chế độ Smart Deeplink (mở thẳng App Shopee, TikTok, Lazada)
      if (link.type === 'deeplink') {
        const deeplink = parseDeeplink(destination);
        return res.send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Đang mở ứng dụng ${deeplink.platform}...</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
          </head>
          <body class="bg-[#0b101b] text-slate-100 flex flex-col items-center justify-center min-h-screen p-4 font-sans select-none">
            <div class="max-w-sm w-full bg-[#131b2e] border border-slate-700/70 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
              
              <!-- Glow background -->
              <div class="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>

              <!-- Animated Icon -->
              <div class="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center">
                <div class="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
                <div class="w-14 h-14 rounded-full bg-gradient-to-tr from-[#06557c] to-[#32af5e] flex items-center justify-center text-white text-2xl shadow-lg">
                  ${deeplink.platform === 'TikTok' ? '<i class="fa-brands fa-tiktok"></i>' : (deeplink.platform === 'Shopee' ? '<i class="fa-solid fa-bag-shopping"></i>' : '<i class="fa-solid fa-rocket"></i>')}
                </div>
              </div>

              <h2 class="text-xl font-extrabold text-white mb-1.5">Đang mở App ${deeplink.platform}...</h2>
              <p class="text-slate-400 text-xs mb-6 leading-relaxed">
                Đang tự động chuyển bạn vào ứng dụng <span class="text-emerald-400 font-semibold">${deeplink.platform}</span> trên điện thoại.
              </p>

              <!-- Main CTA button - Khi bấm trực tiếp luôn luôn mở app 100% không bị chặn -->
              <div class="space-y-3">
                <a id="btnOpenApp" href="#" onclick="triggerOpenApp(event)"
                   class="flex items-center justify-center gap-2 w-full py-4 px-5 bg-gradient-to-r from-[#06557c] to-[#32af5e] hover:opacity-95 text-white font-bold text-sm rounded-2xl shadow-xl shadow-emerald-950/40 active:scale-95 transition animate-pulse">
                  <span>MỞ TRONG APP ${deeplink.platform.toUpperCase()}</span>
                  <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                </a>

                <a href="${destination}" id="btnWebFallback"
                   class="block w-full py-3 px-4 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-semibold rounded-2xl border border-slate-700/80 transition">
                  Tiếp tục qua trình duyệt web
                </a>
              </div>

              <div class="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <i class="fa-solid fa-shield-halved text-emerald-400"></i>
                Bảo vệ bởi <span class="text-slate-400 font-semibold">BoclinkVN Deeplink</span>
              </div>
            </div>

            <!-- Hidden trigger anchor -->
            <a id="hiddenTrigger" style="display:none;"></a>

            <script>
              const iosScheme = ${JSON.stringify(deeplink.iosScheme || null)};
              const iosAltScheme = ${JSON.stringify(deeplink.iosAltScheme || null)};
              const androidIntent = ${JSON.stringify(deeplink.androidIntent || null)};
              const androidScheme = ${JSON.stringify(deeplink.androidScheme || null)};
              const webUrl = ${JSON.stringify(destination)};

              const ua = navigator.userAgent || navigator.vendor || window.opera;
              const isAndroid = /android/i.test(ua);
              const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

              let targetScheme = webUrl;
              if (isAndroid) {
                targetScheme = androidIntent || androidScheme || webUrl;
              } else if (isIOS) {
                targetScheme = iosScheme || iosAltScheme || webUrl;
              }

              // Gán href vào nút chính
              document.getElementById('btnOpenApp').href = targetScheme;

              let fallbackTimer = null;
              function clearFallback() {
                if (fallbackTimer) {
                  clearTimeout(fallbackTimer);
                  fallbackTimer = null;
                }
              }

              // Khi chuyển app thành công, trình duyệt sẽ bị blur hoặc hidden
              window.addEventListener('blur', clearFallback);
              window.addEventListener('pagehide', clearFallback);
              document.addEventListener('visibilitychange', function() {
                if (document.hidden) clearFallback();
              });

              function triggerOpenApp(e) {
                if (e) e.preventDefault();
                clearFallback();

                if (isAndroid) {
                  // Trên Android: dùng Intent URL là cách duy nhất kích hoạt app trực tiếp từ Chrome/FB
                  window.location.href = targetScheme;
                } else if (isIOS) {
                  // Trên iOS: dùng scheme chính, nếu lỗi dùng scheme phụ
                  window.location.href = targetScheme;
                  setTimeout(function() {
                    if (iosAltScheme && !document.hidden) {
                      window.location.href = iosAltScheme;
                    }
                  }, 800);
                } else {
                  // Desktop: mở thẳng web
                  window.location.href = webUrl;
                }
              }

              // Tự động kích hoạt khi vừa tải trang
              if (isAndroid || isIOS) {
                try {
                  triggerOpenApp();
                } catch(e) {}

                // Fallback sau 5s nếu người dùng chưa mở app và trang vẫn hiển thị
                fallbackTimer = setTimeout(function() {
                  if (!document.hidden) {
                    console.log('App not opened, fallback to web');
                  }
                }, 5000);
              } else {
                // Người dùng trên PC / Desktop: chuyển thẳng vào link web sau 1 giây
                setTimeout(function() {
                  window.location.href = webUrl;
                }, 1000);
              }
            </script>
          </body>
          </html>
        `);
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
