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

  return /bot|crawler|spider|crawling|facebookexternalhit|facebot|facebookcatalog|meta-externalagent|twitterbot|whatsapp|telegrambot|linkedinbot|pinterest|slackbot|vkshare|zalo|discordbot|googlebot|bingbot|yandex|duckduckbot|applebot|bytespider|tiktokbot|curl|wget|python|postman|render|uptimerobot|headlesschrome|phantomjs/i.test(ua);
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
