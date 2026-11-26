import type { CalendarEvent } from '../../shared/types.js';

function unfoldIcsLines(raw: string): string[] {
  return raw.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescapeIcsText(val: string): string {
  return val
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function parseIcsDate(rawVal: string): { date: string; time: string | null; allDay: boolean } | null {
  const val = rawVal.trim();
  // All-day: YYYYMMDD
  if (/^\d{8}$/.test(val)) {
    return {
      date: `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`,
      time: null,
      allDay: true,
    };
  }
  // Date-time: YYYYMMDDTHHMMSS(Z)?
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, isUtc] = m;
  if (isUtc === 'Z') {
    const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
    const ly = dt.getFullYear();
    const lmo = String(dt.getMonth() + 1).padStart(2, '0');
    const ld = String(dt.getDate()).padStart(2, '0');
    const lh = String(dt.getHours()).padStart(2, '0');
    const lmi = String(dt.getMinutes()).padStart(2, '0');
    return { date: `${ly}-${lmo}-${ld}`, time: `${lh}:${lmi}`, allDay: false };
  }
  return {
    date: `${y}-${mo}-${d}`,
    time: `${h}:${mi}`,
    allDay: false,
  };
}

export function parseIcsEvents(rawIcs: string, fromDate?: string, toDate?: string): CalendarEvent[] {
  const lines = unfoldIcsLines(rawIcs);
  const events: CalendarEvent[] = [];
  let inEvent = false;
  let uid = '';
  let summary = '';
  let location = '';
  let dtStart: { date: string; time: string | null; allDay: boolean } | null = null;
  let dtEnd: { date: string; time: string | null; allDay: boolean } | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      uid = '';
      summary = '';
      location = '';
      dtStart = null;
      dtEnd = null;
      continue;
    }
    if (line === 'END:VEVENT') {
      if (inEvent && dtStart && summary) {
        const inRange =
          (!fromDate || dtStart.date >= fromDate) && (!toDate || dtStart.date <= toDate);
        if (inRange) {
          events.push({
            id: uid || `${dtStart.date}-${summary}-${events.length}`,
            title: summary,
            date: dtStart.date,
            start_time: dtStart.time,
            end_time: dtEnd?.time ?? null,
            all_day: dtStart.allDay,
            location: location || undefined,
            source: 'google',
          });
        }
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const keyPart = line.slice(0, colonIdx).toUpperCase();
    const valuePart = line.slice(colonIdx + 1);
    const propName = keyPart.split(';')[0];

    if (propName === 'UID') uid = valuePart.trim();
    else if (propName === 'SUMMARY') summary = unescapeIcsText(valuePart);
    else if (propName === 'LOCATION') location = unescapeIcsText(valuePart);
    else if (propName === 'DTSTART') dtStart = parseIcsDate(valuePart);
    else if (propName === 'DTEND') dtEnd = parseIcsDate(valuePart);
  }

  return events.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return (a.start_time ?? '').localeCompare(b.start_time ?? '');
  });
}

export function buildTasksIcs(
  tasks: Array<{
    id: number;
    title: string;
    notes: string;
    due_date: string;
    scheduled_start: string | null;
  }>
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Melody Planner//Tasks//EN',
    'X-WR-CALNAME:Melody Planner',
  ];

  for (const t of tasks) {
    const compactDate = t.due_date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:melody-task-${t.id}@melody-planner`);
    if (t.scheduled_start) {
      const hhmm = t.scheduled_start.replace(':', '');
      lines.push(`DTSTART:${compactDate}T${hhmm}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDate}`);
    }
    lines.push(`SUMMARY:${t.title.replace(/[,;\\]/g, ' ')}`);
    if (t.notes) lines.push(`DESCRIPTION:${t.notes.replace(/\n/g, '\\n')}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
