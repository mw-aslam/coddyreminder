const moment = require('moment-timezone');

/**
 * Parses a user-provided date string into a moment object.
 * Supports: DD.MM.YYYY, YYYY-MM-DD, "today", "tomorrow", "сегодня", "завтра", "bugun", "ertaga"
 */
function parseDate(input, timezone = 'UTC') {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim().toLowerCase();
  const now = moment().tz(timezone);

  if (['today', 'сегодня', 'bugun'].includes(trimmed)) {
    return now.clone().startOf('day');
  }

  if (['tomorrow', 'завтра', 'ertaga'].includes(trimmed)) {
    return now.clone().add(1, 'day').startOf('day');
  }

  const formats = ['DD.MM.YYYY', 'YYYY-MM-DD', 'D.M.YYYY', 'D.M.YY'];
  for (const fmt of formats) {
    const parsed = moment.tz(input.trim(), fmt, true, timezone);
    if (parsed.isValid()) return parsed;
  }

  return null;
}

/**
 * Parses a user-provided time string (HH:mm or H:mm).
 * Returns { hours, minutes } or null.
 */
function parseTime(input) {
  if (!input || typeof input !== 'string') return null;

  const match = input.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return { hours, minutes };
}

/**
 * Combines a date moment and time object into a full datetime moment.
 */
function combineDateAndTime(dateMoment, timeObj, timezone = 'UTC') {
  if (!dateMoment || !timeObj) return null;

  const momentObj = moment.isMoment(dateMoment) ? dateMoment.clone() : moment(dateMoment);

  return momentObj
    .tz(timezone)
    .set({ hour: timeObj.hours, minute: timeObj.minutes, second: 0, millisecond: 0 });
}

/**
 * Formats a moment to display string.
 */
function formatDisplay(momentObj, timezone = 'UTC') {
  if (!momentObj) return 'Unknown';
  const m = moment.isMoment(momentObj) ? momentObj : moment(momentObj);
  return m.tz(timezone).format('DD.MM.YYYY HH:mm');
}

/**
 * Checks if a given datetime is in the future.
 */
function isFuture(momentObj) {
  if (!momentObj) return false;
  const m = moment.isMoment(momentObj) ? momentObj : moment(momentObj);
  return m.isAfter(moment());
}

module.exports = { parseDate, parseTime, combineDateAndTime, formatDisplay, isFuture };

