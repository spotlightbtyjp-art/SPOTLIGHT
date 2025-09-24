import { format, toZonedTime } from 'date-fns-tz';

export function formatBangkokDate(date, formatStr = 'yyyy-MM-dd HH:mm') {
  const timeZone = 'Asia/Bangkok';
  const zonedDate = toZonedTime(date, timeZone);
  return format(zonedDate, formatStr, { timeZone });
}

export function getBangkokDate(date) {
  const timeZone = 'Asia/Bangkok';
  return toZonedTime(date, timeZone);
}
