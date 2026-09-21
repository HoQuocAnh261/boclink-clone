/**
 * Helper chuyển đổi URL web sang deep link schema cho app di động (Shopee, TikTok, Lazada, YouTube)
 */

export interface DeeplinkInfo {
  isDeeplinkable: boolean;
  platform: string;
  appScheme?: string;
  originalUrl: string;
}

export function parseDeeplink(urlStr: string): DeeplinkInfo {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();

    // 1. Shopee (Việt Nam & Quốc tế)
    if (host.includes('shopee.vn') || host.includes('shp.ee') || host.includes('s.shopee.vn')) {
      // Schema Shopee: shopeevn://...
      const encodedUrl = encodeURIComponent(urlStr);
      return {
        isDeeplinkable: true,
        platform: 'Shopee',
        appScheme: `shopeevn://universal-link?url=${encodedUrl}`,
        originalUrl: urlStr
      };
    }

    // 2. TikTok / TikTok Shop
    if (host.includes('tiktok.com') || host.includes('vt.tiktok.com')) {
      const encodedUrl = encodeURIComponent(urlStr);
      return {
        isDeeplinkable: true,
        platform: 'TikTok',
        appScheme: `snssdk1180://webview?url=${encodedUrl}`,
        originalUrl: urlStr
      };
    }

    // 3. Lazada
    if (host.includes('lazada.vn') || host.includes('s.lazada.vn')) {
      const encodedUrl = encodeURIComponent(urlStr);
      return {
        isDeeplinkable: true,
        platform: 'Lazada',
        appScheme: `lazada://lazada.vn?url=${encodedUrl}`,
        originalUrl: urlStr
      };
    }

    // 4. YouTube
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return {
        isDeeplinkable: true,
        platform: 'YouTube',
        appScheme: `vnd.youtube://${url.pathname}${url.search}`,
        originalUrl: urlStr
      };
    }

    // Default: không có app scheme đặc biệt
    return {
      isDeeplinkable: false,
      platform: 'Web',
      appScheme: undefined,
      originalUrl: urlStr
    };
  } catch {
    return {
      isDeeplinkable: false,
      platform: 'Web',
      appScheme: undefined,
      originalUrl: urlStr
    };
  }
}
