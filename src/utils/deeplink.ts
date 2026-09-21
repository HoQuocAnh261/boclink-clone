/**
 * Helper chuyển đổi URL web sang deep link schema cho app di động (Shopee, TikTok, Lazada, YouTube)
 */

export interface DeeplinkInfo {
  isDeeplinkable: boolean;
  platform: string;
  iosScheme?: string;
  iosAltScheme?: string;
  androidIntent?: string;
  androidScheme?: string;
  originalUrl: string;
}

export function parseDeeplink(urlStr: string): DeeplinkInfo {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    const encodedUrl = encodeURIComponent(urlStr);
    const urlWithoutProtocol = urlStr.replace(/^https?:\/\//, '');

    // 1. TikTok / TikTok Shop / vt.tiktok.com
    if (host.includes('tiktok.com') || host.includes('vt.tiktok.com')) {
      // Kiểm tra nếu là link video có ID cụ thể (ví dụ: /video/1234567890)
      const videoMatch = url.pathname.match(/\/video\/(\d+)/) || url.pathname.match(/\/detail\/(\d+)/);
      // Kiểm tra nếu là profile (@username)
      const userMatch = url.pathname.match(/\/@([a-zA-Z0-9._]+)/);

      let iosScheme = `snssdk1233://webview?url=${encodedUrl}`;
      let iosAltScheme = `tiktok://webview?url=${encodedUrl}`;

      if (videoMatch && videoMatch[1]) {
        const videoId = videoMatch[1];
        iosScheme = `snssdk1233://aweme/detail/${videoId}`;
        iosAltScheme = `tiktok://aweme/detail/${videoId}`;
      } else if (userMatch && userMatch[1]) {
        const username = userMatch[1];
        iosScheme = `snssdk1233://user/profile/${username}`;
        iosAltScheme = `tiktok://user/profile/${username}`;
      }

      // Android Intent - Cơ chế kích hoạt app TikTok mạnh nhất trên Android
      const androidIntent = `intent://${urlWithoutProtocol}#Intent;package=com.zhiliaoapp.musically;scheme=https;end;`;
      const androidScheme = `snssdk1233://webview?url=${encodedUrl}`;

      return {
        isDeeplinkable: true,
        platform: 'TikTok',
        iosScheme,
        iosAltScheme,
        androidIntent,
        androidScheme,
        originalUrl: urlStr
      };
    }

    // 2. Shopee (Việt Nam & Quốc tế)
    if (host.includes('shopee.vn') || host.includes('shp.ee') || host.includes('s.shopee.vn')) {
      return {
        isDeeplinkable: true,
        platform: 'Shopee',
        iosScheme: `shopeevn://universal-link?url=${encodedUrl}`,
        iosAltScheme: `shopeevn://`,
        androidIntent: `intent://${urlWithoutProtocol}#Intent;package=com.shopee.vn;scheme=https;end;`,
        androidScheme: `shopeevn://universal-link?url=${encodedUrl}`,
        originalUrl: urlStr
      };
    }

    // 3. Lazada
    if (host.includes('lazada.vn') || host.includes('s.lazada.vn')) {
      return {
        isDeeplinkable: true,
        platform: 'Lazada',
        iosScheme: `lazada://lazada.vn?url=${encodedUrl}`,
        iosAltScheme: `lazada://`,
        androidIntent: `intent://${urlWithoutProtocol}#Intent;package=com.lazada.android;scheme=https;end;`,
        androidScheme: `lazada://lazada.vn?url=${encodedUrl}`,
        originalUrl: urlStr
      };
    }

    // 4. YouTube
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return {
        isDeeplinkable: true,
        platform: 'YouTube',
        iosScheme: `vnd.youtube://${url.pathname}${url.search}`,
        iosAltScheme: `youtube://`,
        androidIntent: `intent://${urlWithoutProtocol}#Intent;package=com.google.android.youtube;scheme=https;end;`,
        androidScheme: `vnd.youtube://${url.pathname}${url.search}`,
        originalUrl: urlStr
      };
    }

    // Mặc định
    return {
      isDeeplinkable: false,
      platform: 'Web',
      originalUrl: urlStr
    };
  } catch {
    return {
      isDeeplinkable: false,
      platform: 'Web',
      originalUrl: urlStr
    };
  }
}
