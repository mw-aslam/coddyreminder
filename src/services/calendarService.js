const reminderRepository = require('../database/repositories/reminderRepository');

function toICSDate(date) {
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICS(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

async function generateICSForUser(userId) {
  const reminders = await reminderRepository.getUserReminders(userId);
  if (!reminders || reminders.length === 0) {
    return null;
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Coddy Reminder Bot//NONSGML v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Coddy Reminders',
  ];

  for (const reminder of reminders) {
    const start = new Date(reminder.remind_at);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    ics.push(
      'BEGIN:VEVENT',
      `UID:reminder-${reminder.id}@coddyreminder.bot`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${escapeICS(reminder.text)}`,
      `DESCRIPTION:${escapeICS(`Group/Chat: ${reminder.group_title || 'Private'}`)}`,
      'END:VEVENT'
    );
  }

  ics.push('END:VCALENDAR');
  return {
    icsString: ics.join('\r\n'),
    reminders,
  };
}

module.exports = { generateICSForUser };
