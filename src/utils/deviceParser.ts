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

const VN_CITY_MAP: Record<string, string> = {
  'ho chi minh city': 'TP. Hồ Chí Minh',
  'ho chi minh': 'TP. Hồ Chí Minh',
  'saigon': 'TP. Hồ Chí Minh',
  'hanoi': 'Hà Nội',
  'ha noi': 'Hà Nội',
  'da nang': 'Đà Nẵng',
  'danang': 'Đà Nẵng',
  'hai phong': 'Hải Phòng',
  'can tho': 'Cần Thơ',
  'bien hoa': 'Biên Hòa',
  'nha trang': 'Nha Trang',
  'hue': 'Huế',
  'vung tau': 'Vũng Tàu',
  'buon ma thuot': 'Buôn Ma Thuột',
  'quy nhon': 'Quy Nhơn',
  'phan thiet': 'Phan Thiết',
  'rach gia': 'Rạch Giá',
  'long xuyen': 'Long Xuyên',
  'thai nguyen': 'Thái Nguyên',
  'bac ninh': 'Bắc Ninh',
  'nam dinh': 'Nam Định',
  'ha long': 'Hạ Long',
  'vinh': 'Vinh',
  'pleiku': 'Pleiku'
};

/**
 * Xác định vị trí địa lý của IP và kiểm tra xem có phải từ Việt Nam không
 * Hỗ trợ nhận diện người dùng iPhone dùng iCloud Private Relay, 1.1.1.1 WARP VPN hoặc 4G
 */
export function getGeoLocation(ip: string, cfCountry?: string, cfCity?: string, acceptLanguage?: string): GeoInfo {
  // Cho phép Localhost trong môi trường test/local
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {
      isVietnam: true,
      country: 'VN',
      city: 'Localhost',
      location: 'Hà Nội, Việt Nam (Local)'
    };
  }

  let countryCode = (cfCountry || '').trim().toUpperCase();
  let cityName = (cfCity || '').trim();

  // Tra cứu offline bằng geoip-lite
  const geo = geoip.lookup(ip);
  if (!countryCode || countryCode === 'XX' || countryCode === 'T1') {
    if (geo) {
      countryCode = geo.country || '';
      if (!cityName && geo.city) {
        cityName = geo.city;
      }
    }
  } else if (!cityName && geo && geo.city) {
    cityName = geo.city;
  }

  // Kiểm tra ngôn ngữ thiết bị (iPhone/Android người dùng tại VN)
  const isVietnameseDevice = /vi-VN|vi/i.test(acceptLanguage || '');

  // Xác định có phải Việt Nam không:
  // 1. Nếu countryCode là VN
  // 2. Hoặc thiết bị dùng tiếng Việt (kể cả qua iCloud Private Relay, 1.1.1.1 WARP VPN hoặc mạng 4G mới)
  // 3. Nếu chưa rõ quốc gia nhưng là thiết bị di động bình thường
  const isVietnam = countryCode === 'VN' || isVietnameseDevice || !countryCode;

  // Chuyển tên thành phố sang tiếng Việt chuẩn đẹp
  let cleanCity = cityName;
  if (cityName && VN_CITY_MAP[cityName.toLowerCase()]) {
    cleanCity = VN_CITY_MAP[cityName.toLowerCase()];
  } else if (!cleanCity && isVietnam) {
    cleanCity = isVietnameseDevice && countryCode !== 'VN' && countryCode ? 'Việt Nam (iCloud/VPN)' : 'Việt Nam';
  }

  let location = 'Không xác định';
  if (isVietnam) {
    location = cleanCity ? `${cleanCity}, VN` : 'Việt Nam';
  } else if (countryCode) {
    location = cleanCity ? `${cleanCity}, ${countryCode}` : countryCode;
  }

  return {
    isVietnam,
    country: isVietnam ? 'VN' : (countryCode || 'Khác'),
    city: cleanCity || (isVietnam ? 'Việt Nam' : 'Quốc tế'),
    location
  };
}


