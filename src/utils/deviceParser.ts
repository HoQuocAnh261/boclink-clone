import { UAParser } from 'ua-parser-js';

export interface DeviceInfo {
  device: string;
  deviceType: string;
  browser: string;
  os: string;
}

/**
 * Kiểm tra xem User-Agent có phải là Bot / Crawler / Pingers không
 */
export function isCrawlerBot(ua: string | undefined): boolean {
  if (!ua || ua.length < 15) return true;

  // 1. Nếu là người dùng thật trong các ứng dụng di động phổ biến -> KHÔNG PHẢI BOT!
  if (/ZaloAppVersion|ZaloTheme|ZaloLanguage/i.test(ua)) {
    return false; // Zalo App trên điện thoại
  }
  if (/FBAN|FBIOS|FB4A|FB_IAB/i.test(ua)) {
    return false; // Facebook App trên điện thoại
  }
  if (/musical_ly|trill|ByteLocale/i.test(ua) || (/TikTok/i.test(ua) && !/tiktokbot|bytespider/i.test(ua))) {
    return false; // TikTok App trên điện thoại
  }
  if (/Instagram/i.test(ua)) {
    return false; // Instagram App trên điện thoại
  }

  // 2. Lọc các bot cào link preview & crawler tự động
  return /facebookexternalhit|facebot|facebookcatalog|meta-externalagent|twitterbot|whatsapp|telegrambot|linkedinbot|pinterest|slackbot|vkshare|zalo-link-preview|zalobot|discordbot|googlebot|bingbot|yandex|duckduckbot|applebot|bytespider|tiktokbot|curl|wget|python|postman|render|uptimerobot|headlesschrome|phantomjs|crawler|spider/i.test(ua);
}


/**
 * Nhận diện chi tiết Thiết bị (iPhone, Samsung...), Hệ điều hành, Trình duyệt / App (Facebook, Zalo...)
 */
export function parseDeviceInfo(ua: string | undefined): DeviceInfo {
  if (!ua) {
    return {
      device: 'Không xác định',
      deviceType: 'Không xác định',
      browser: 'Không xác định',
      os: 'Không xác định'
    };
  }

  const parser = new UAParser(ua);
  const res = parser.getResult();

  // 1. Hệ điều hành (OS)
  const osName = res.os.name || 'Khác';
  const osVersion = res.os.version ? ` ${res.os.version}` : '';
  const fullOs = `${osName}${osVersion}`.trim();

  // 2. Trình duyệt / Môi trường App
  let browserName = res.browser.name || 'Khác';
  if (/FBAN|FBIOS|FB4A|FB_IAB/i.test(ua) || browserName.toLowerCase().includes('facebook')) {
    browserName = 'Facebook App';
  } else if (/Zalo/i.test(ua) || browserName.toLowerCase().includes('zalo')) {
    browserName = 'Zalo App';
  } else if (/TikTok/i.test(ua) || browserName.toLowerCase().includes('tiktok')) {
    browserName = 'TikTok App';
  } else if (/Instagram/i.test(ua)) {
    browserName = 'Instagram App';
  } else if (/Chrome/i.test(browserName) && /Mobile|Android|iPhone|iPad/i.test(ua)) {
    browserName = 'Chrome Mobile';
  } else if (/Safari/i.test(browserName) && /iPhone|iPad/i.test(ua)) {
    browserName = 'Safari Mobile';
  }

  // 3. Thiết bị (Device) & Loại thiết bị (Device Type)
  let deviceType = 'Máy tính';
  let deviceName = 'Máy tính (PC / Laptop)';

  const isMobile = /mobile|iphone|ipod|android.*mobile/i.test(ua) || res.device.type === 'mobile';
  const isTablet = /ipad|tablet|android(?!.*mobile)/i.test(ua) || res.device.type === 'tablet';

  if (isTablet) {
    deviceType = 'Máy tính bảng';
    if (/ipad/i.test(ua) || res.device.model === 'iPad') {
      deviceName = 'Apple iPad';
    } else {
      deviceName = res.device.vendor ? `${res.device.vendor} Tablet` : 'Tablet';
    }
  } else if (isMobile) {
    deviceType = 'Điện thoại';
    if (/iphone/i.test(ua) || res.os.name === 'iOS' || res.device.vendor === 'Apple') {
      deviceName = res.device.model ? `Apple ${res.device.model}` : 'Apple iPhone';
    } else if (res.device.vendor && res.device.model) {
      deviceName = `${res.device.vendor} ${res.device.model}`;
    } else if (res.device.vendor) {
      deviceName = `Điện thoại ${res.device.vendor}`;
    } else if (/android/i.test(ua)) {
      deviceName = 'Điện thoại Android';
    } else {
      deviceName = 'Điện thoại di động';
    }
  } else {
    deviceType = 'Máy tính';
    if (res.os.name === 'Mac OS') {
      deviceName = 'Apple Mac';
    } else if (res.os.name === 'Windows') {
      deviceName = 'Máy tính Windows';
    } else if (res.os.name === 'Linux') {
      deviceName = 'Máy tính Linux';
    } else {
      deviceName = 'Máy tính (PC)';
    }
  }

  return {
    device: deviceName,
    deviceType,
    browser: browserName,
    os: fullOs
  };
}


import geoip from 'geoip-lite';

export interface GeoInfo {
  isVietnam: boolean;
  country: string;
  city: string;
  location: string;
}

const VN_PROVINCES_MAP: Record<string, string> = {
  // 5 Thành phố trực thuộc Trung ương
  'ha noi': 'Hà Nội',
  'hanoi': 'Hà Nội',
  'ho chi minh': 'TP. Hồ Chí Minh',
  'ho chi minh city': 'TP. Hồ Chí Minh',
  'saigon': 'TP. Hồ Chí Minh',
  'sai gon': 'TP. Hồ Chí Minh',
  'da nang': 'Đà Nẵng',
  'danang': 'Đà Nẵng',
  'hai phong': 'Hải Phòng',
  'haiphong': 'Hải Phòng',
  'can tho': 'Cần Thơ',
  'cantho': 'Cần Thơ',

  // Miền Bắc
  'bac giang': 'Bắc Giang',
  'bac kan': 'Bắc Kạn',
  'bac ninh': 'Bắc Ninh',
  'cao bang': 'Cao Bằng',
  'dien bien': 'Điện Biên',
  'ha giang': 'Hà Giang',
  'ha nam': 'Hà Nam',
  'hai duong': 'Hải Dương',
  'hoa binh': 'Hòa Bình',
  'hung yen': 'Hưng Yên',
  'lai chau': 'Lai Châu',
  'lang son': 'Lạng Sơn',
  'lao cai': 'Lào Cai',
  'nam dinh': 'Nam Định',
  'ninh binh': 'Ninh Bình',
  'phu tho': 'Phú Thọ',
  'viet tri': 'Phú Thọ',
  'quang ninh': 'Quảng Ninh',
  'ha long': 'Quảng Ninh',
  'cam pha': 'Quảng Ninh',
  'son la': 'Sơn La',
  'thai binh': 'Thái Bình',
  'thai nguyen': 'Thái Nguyên',
  'tuyen quang': 'Tuyên Quang',
  'vinh phuc': 'Vĩnh Phúc',
  'vinh yen': 'Vĩnh Phúc',
  'yen bai': 'Yên Bái',

  // Miền Trung & Tây Nguyên
  'ha tinh': 'Hà Tĩnh',
  'nghe an': 'Nghệ An',
  'vinh': 'Nghệ An',
  'quang binh': 'Quảng Bình',
  'dong hoi': 'Quảng Bình',
  'quang tri': 'Quảng Trị',
  'dong ha': 'Quảng Trị',
  'thua thien hue': 'Thừa Thiên Huế',
  'thua thien - hue': 'Thừa Thiên Huế',
  'hue': 'Thừa Thiên Huế',
  'quang nam': 'Quảng Nam',
  'tam ky': 'Quảng Nam',
  'hoi an': 'Quảng Nam',
  'quang ngai': 'Quảng Ngãi',
  'binh dinh': 'Bình Định',
  'quy nhon': 'Bình Định',
  'phu yen': 'Phú Yên',
  'tuy hoa': 'Phú Yên',
  'khanh hoa': 'Khánh Hòa',
  'nha trang': 'Khánh Hòa',
  'cam ranh': 'Khánh Hòa',
  'ninh thuan': 'Ninh Thuận',
  'phan rang': 'Ninh Thuận',
  'binh thuan': 'Bình Thuận',
  'phan thiet': 'Bình Thuận',
  'dak lak': 'Đắk Lắk',
  'dac lac': 'Đắk Lắk',
  'buon ma thuot': 'Đắk Lắk',
  'dak nong': 'Đắk Nông',
  'dac nong': 'Đắk Nông',
  'gia lai': 'Gia Lai',
  'pleiku': 'Gia Lai',
  'kon tum': 'Kon Tum',
  'lam dong': 'Lâm Đồng',
  'da lat': 'Lâm Đồng',
  'bao loc': 'Lâm Đồng',

  // Miền Nam & ĐBSCL
  'ba ria - vung tau': 'Bà Rịa - Vũng Tàu',
  'ba ria-vung tau': 'Bà Rịa - Vũng Tàu',
  'vung tau': 'Bà Rịa - Vũng Tàu',
  'binh duong': 'Bình Dương',
  'thu dau mot': 'Bình Dương',
  'binh phuoc': 'Bình Phước',
  'dong xoai': 'Bình Phước',
  'dong nai': 'Đồng Nai',
  'bien hoa': 'Đồng Nai',
  'tay ninh': 'Tây Ninh',
  'an giang': 'An Giang',
  'long xuyen': 'An Giang',
  'chau doc': 'An Giang',
  'bac lieu': 'Bạc Liêu',
  'ben tre': 'Bến Tre',
  'ca mau': 'Cà Mau',
  'dong thap': 'Đồng Tháp',
  'cao lanh': 'Đồng Tháp',
  'sa dec': 'Đồng Tháp',
  'hau giang': 'Hậu Giang',
  'vi thanh': 'Hậu Giang',
  'kien giang': 'Kiên Giang',
  'rach gia': 'Kiên Giang',
  'phu quoc': 'Kiên Giang',
  'long an': 'Long An',
  'tan an': 'Long An',
  'soc trang': 'Sóc Trăng',
  'tien giang': 'Tiền Giang',
  'my tho': 'Tiền Giang',
  'tra vinh': 'Trà Vinh',
  'vinh long': 'Vĩnh Long'
};

export function normalizeVnProvince(name: string): string {
  if (!name) return '';
  const key = name.toLowerCase().replace(/^(tinh|thanh pho|tp\.|t\.)\s+/i, '').trim();
  return VN_PROVINCES_MAP[key] || name;
}

const ipGeoCache = new Map<string, GeoInfo>();

/**
 * Xác định chính xác Tỉnh / Thành phố tại Việt Nam cho địa chỉ IP
 * Tra cứu tốc độ cao (0ms cache, fallback ip-api.com và geoip-lite)
 */
export async function getGeoLocation(
  ip: string,
  cfCountry?: string,
  cfCity?: string,
  acceptLanguage?: string
): Promise<GeoInfo> {
  // Cho phép Localhost trong môi trường test/local
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {
      isVietnam: true,
      country: 'VN',
      city: 'Đà Nẵng',
      location: 'Đà Nẵng, VN'
    };
  }

  // 1. Kiểm tra cache trong bộ nhớ (0ms)
  if (ipGeoCache.has(ip)) {
    return ipGeoCache.get(ip)!;
  }

  let countryCode = (cfCountry || '').trim().toUpperCase();
  let cityName = (cfCity || '').trim();

  // 2. Tra cứu Cloudflare headers nếu có sẵn
  if (cityName) {
    cityName = normalizeVnProvince(cityName);
  }

  // 3. Nếu chưa có tên tỉnh thành chính xác, tra cứu qua ip-api.com với timeout 800ms
  if (!cityName || cityName === 'Việt Nam' || !countryCode || countryCode === 'XX') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data: any = await res.json();
        if (data.status === 'success') {
          if (!countryCode || countryCode === 'XX') {
            countryCode = (data.countryCode || '').toUpperCase();
          }
          const rawLocationName = data.regionName || data.city || '';
          if (rawLocationName) {
            cityName = normalizeVnProvince(rawLocationName);
          }
        }
      }
    } catch {
      // Timeout hoặc lỗi mạng -> tiếp tục fallback offline
    }
  }

  // 4. Fallback offline geoip-lite nếu vẫn chưa có
  if (!cityName || !countryCode || countryCode === 'XX') {
    const geo = geoip.lookup(ip);
    if (geo) {
      if (!countryCode || countryCode === 'XX') {
        countryCode = geo.country || '';
      }
      if (!cityName && geo.city) {
        cityName = normalizeVnProvince(geo.city);
      }
    }
  }

  // 5. Kiểm tra ngôn ngữ thiết bị (hỗ trợ iPhone iCloud Private Relay / WARP VPN)
  const isVietnameseDevice = /vi-VN|vi/i.test(acceptLanguage || '');
  const isVietnam = countryCode === 'VN' || isVietnameseDevice || !countryCode;

  if (isVietnam) {
    if (!cityName) {
      cityName = isVietnameseDevice && countryCode !== 'VN' && countryCode ? 'Việt Nam (iCloud/VPN)' : 'Việt Nam';
    } else {
      cityName = normalizeVnProvince(cityName);
    }
  }

  const result: GeoInfo = {
    isVietnam,
    country: isVietnam ? 'VN' : (countryCode || 'Khác'),
    city: cityName || (isVietnam ? 'Việt Nam' : 'Quốc tế'),
    location: cityName ? `${cityName}, ${isVietnam ? 'VN' : countryCode}` : (isVietnam ? 'Việt Nam' : countryCode)
  };

  // Lưu cache bộ nhớ (tối đa 10,000 IPs)
  if (ipGeoCache.size > 10000) {
    ipGeoCache.clear();
  }
  ipGeoCache.set(ip, result);

  return result;
}


