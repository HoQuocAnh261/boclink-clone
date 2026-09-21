/**
 * Helper chuyển đổi URL web sang deep link schema cho app di động (Shopee, TikTok, Lazada, YouTube)
 */

export interface DeeplinkInfo {
  isDeeplinkable: boolean;
  platform: string;
  isShopProduct?: boolean;
  productId?: string;
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
      // A. KIỂM TRA SẢN PHẨM TIKTOK SHOP (PDP)
      // Các dạng: /vn/pdp/1729601281544456787, /view/product/1729..., ?product_id=1729...
      const pdpMatch = url.pathname.match(/\/pdp\/(\d+)/) || 
                       url.pathname.match(/\/product\/(\d+)/) ||
                       url.pathname.match(/\/view\/product\/(\d+)/);
      const queryProductId = url.searchParams.get('product_id');
      const productId = (pdpMatch && pdpMatch[1]) || queryProductId;

      if (productId) {
        // Schema chính xác nhất để mở thẳng vào trang chi tiết sản phẩm TikTok Shop
        const iosScheme = `snssdk1233://ec/pdp?product_id=${productId}`;
        const iosAltScheme = `tiktok://ec/pdp?product_id=${productId}`;
        
        // Android Intent nhắm thẳng vào ecommerce product detail page của TikTok
        const androidIntent = `intent://ec/pdp?product_id=${productId}#Intent;package=com.zhiliaoapp.musically;scheme=snssdk1233;end;`;
        const androidScheme = `snssdk1233://ec/pdp?product_id=${productId}`;

        return {
          isDeeplinkable: true,
          platform: 'TikTok Shop',
          isShopProduct: true,
          productId,
          iosScheme,
          iosAltScheme,
          androidIntent,
          androidScheme,
          originalUrl: urlStr
        };
      }

      // B. KIỂM TRA LINK VIDEO TIKTOK (/video/1234567890 hoặc /detail/...)
      const videoMatch = url.pathname.match(/\/video\/(\d+)/) || url.pathname.match(/\/detail\/(\d+)/);
      if (videoMatch && videoMatch[1]) {
        const videoId = videoMatch[1];
        return {
          isDeeplinkable: true,
          platform: 'TikTok',
          iosScheme: `snssdk1233://aweme/detail/${videoId}`,
          iosAltScheme: `tiktok://aweme/detail/${videoId}`,
          androidIntent: `intent://aweme/detail/${videoId}#Intent;package=com.zhiliaoapp.musically;scheme=snssdk1233;end;`,
          androidScheme: `snssdk1233://aweme/detail/${videoId}`,
          originalUrl: urlStr
        };
      }

      // C. KIỂM TRA PROFILE NGƯỜI DÙNG (@username)
      const userMatch = url.pathname.match(/\/@([a-zA-Z0-9._]+)/);
      if (userMatch && userMatch[1]) {
        const username = userMatch[1];
        return {
          isDeeplinkable: true,
          platform: 'TikTok',
          iosScheme: `snssdk1233://user/profile/${username}`,
          iosAltScheme: `tiktok://user/profile/${username}`,
          androidIntent: `intent://user/profile/${username}#Intent;package=com.zhiliaoapp.musically;scheme=snssdk1233;end;`,
          androidScheme: `snssdk1233://user/profile/${username}`,
          originalUrl: urlStr
        };
      }

      // D. CÁC LINK TIKTOK KHÁC (vt.tiktok.com, link affiliate tổng)
      return {
        isDeeplinkable: true,
        platform: 'TikTok',
        iosScheme: `snssdk1233://webview?url=${encodedUrl}`,
        iosAltScheme: `tiktok://webview?url=${encodedUrl}`,
        androidIntent: `intent://${urlWithoutProtocol}#Intent;package=com.zhiliaoapp.musically;scheme=https;end;`,
        androidScheme: `snssdk1233://webview?url=${encodedUrl}`,
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
