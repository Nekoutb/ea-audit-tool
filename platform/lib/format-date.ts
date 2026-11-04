// One way to show a date (F029): DD/MM/YYYY in every language, and times in the
// firm's time zone with the zone named. The data layer keeps ISO dates and
// timestamptz; this is only for the screen, the workbook and the letter.

export const FIRM_TIME_ZONE = "Africa/Douala";
export const FIRM_ZONE_LABEL = "WAT";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// the database layer already formats timestamps this way; JS would read it as MM/DD
const ALREADY_FORMATTED = /^\d{2}\/\d{2}\/\d{4}/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** A calendar date as DD/MM/YYYY. A bare YYYY-MM-DD is never shifted by a time zone. */
export function fmtDate(value: string | Date | null | undefined, empty = "—"): string {
  if (value === null || value === undefined || value === "") return empty;
  if (typeof value === "string") {
    const bare = ISO_DATE.exec(value.trim());
    if (bare) return `${bare[3]}/${bare[2]}/${bare[1]}`;
    if (ALREADY_FORMATTED.test(value)) return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : empty;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: FIRM_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  return parts;
}

/** An instant as "DD/MM/YYYY HH:mm WAT", always in the firm's time zone. */
export function fmtDateTime(value: string | Date | null | undefined, empty = "—"): string {
  if (value === null || value === undefined || value === "") return empty;
  if (typeof value === "string" && ALREADY_FORMATTED.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : empty;
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: FIRM_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => f.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")} ${FIRM_ZONE_LABEL}`;
}

/**
 * The date the annual general meeting must be held by: period end + 6 months
 * (F076). A month-end stays a month-end: 31/12 gives 30/06, 30/06 gives 31/12.
 */
export function agoDeadline(periodEnd: string): string {
  const m = ISO_DATE.exec(periodEnd);
  if (!m) return periodEnd;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const lastOfMonth = (y: number, mo: number) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const targetMonth0 = month - 1 + 6;
  const ty = year + Math.floor(targetMonth0 / 12);
  const tm = (targetMonth0 % 12) + 1;
  const last = lastOfMonth(ty, tm);
  const td = day === lastOfMonth(year, month) ? last : Math.min(day, last);
  return `${ty}-${pad(tm)}-${pad(td)}`;
}
