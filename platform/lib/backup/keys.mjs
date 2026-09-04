// Object keys for the Wasabi store.
//
// The governing rule: PATHS ARE BUILT FROM IDS, WHICH NEVER CHANGE. A firm's
// name and a client's name both change; a COMPLIANCE-locked object cannot be
// moved, only copied, so a slug in the path would permanently orphan a decade
// of a renamed firm's archived files under a prefix nobody thinks to look in.
// Slugs therefore appear only in filenames and in _identity.json, both of which
// are rewritten on every run.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The same expression the engagement export already uses for its download
 * filename (lib/export-bundle.ts), so an object in the bucket and a ZIP a
 * partner downloaded are recognisably the same file.
 */
export function slugify(value, fallback = "unnamed") {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

/** UTC, second precision, lexically sortable — so listing a prefix is chronological. */
export function runId(at = new Date()) {
  return `${at
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")}Z`;
}

function requireUuid(id, what) {
  if (typeof id !== "string" || !UUID.test(id))
    throw new Error(`${what} must be a uuid, got ${JSON.stringify(id)}`);
  return id;
}

function datePath(runid) {
  const m = /^(\d{4})(\d{2})(\d{2})T/.exec(runid);
  if (!m) throw new Error(`unparseable run id: ${runid}`);
  return { year: m[1], month: m[2], day: m[3] };
}

/** ISO week, for the weekly class. */
function isoWeek(runid) {
  const { year, month, day } = datePath(runid);
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const dayNo = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNo + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Tier 1: the whole database and the rebuild set. */
export function dbPrefix(runid, cls) {
  const { year, month, day } = datePath(runid);
  switch (cls) {
    case "daily":
      return `db/daily/${year}/${month}/${day}/${runid}`;
    case "weekly":
      return `db/weekly/${isoWeek(runid).replace("-", "/")}/${runid}`;
    case "monthly":
      return `db/monthly/${year}/${month}/${runid}`;
    case "yearly":
      return `db/yearly/${year}/${runid}`;
    default:
      throw new Error(`unknown class: ${cls}`);
  }
}

/** Tier 2: one firm. */
export function tenantPrefix(tenantId) {
  return `tenant/${requireUuid(tenantId, "tenantId")}`;
}

export function tenantFullKey({ tenantId, tenantName, runid }) {
  const { year } = datePath(runid);
  return `${tenantPrefix(tenantId)}/full/${year}/${runid}--${slugify(tenantName, "firm")}`;
}

/** Tier 3: one engagement, always nested under its firm — an engagement never moves. */
export function engagementPrefix(tenantId, engagementId) {
  return `${tenantPrefix(tenantId)}/engagement/${requireUuid(engagementId, "engagementId")}`;
}

export function engagementRollingKey({ tenantId, engagementId, clientName, fiscalYear, runid }) {
  const base = `${slugify(clientName, "client")}-FY${fiscalYear}`;
  return `${engagementPrefix(tenantId, engagementId)}/rolling/${runid}--${base}`;
}

/**
 * The archival copy. Named by the archive date rather than the run id: there is
 * exactly one per engagement, written once, and it should be findable by the
 * date on the file rather than by when the backup process happened to run.
 */
export function engagementArchiveKey({
  tenantId,
  engagementId,
  clientName,
  fiscalYear,
  archivedAt,
}) {
  const day = new Date(archivedAt).toISOString().slice(0, 10);
  const base = `${slugify(clientName, "client")}-FY${fiscalYear}`;
  return `${engagementPrefix(tenantId, engagementId)}/archive/${day}--${base}`;
}

export function drillKey(runid) {
  const { year, month } = datePath(runid);
  return `drill/${year}/${month}/${runid}.json`;
}

/**
 * Which bucket an object belongs in. Retention is a bucket-level property —
 * rclone cannot set per-object Object Lock — so this function is the whole of
 * the WORM policy: only an archived engagement's copy, and the yearly database
 * anchor, go to the immutable bucket.
 */
export function bucketFor(key) {
  if (/\/archive\//.test(key) || key.startsWith("db/yearly/")) return "archive";
  return "dr";
}

/** Round-trip the structured parts back out of a key, for the restore tools. */
export function parseKey(key) {
  let m = /^tenant\/([0-9a-f-]{36})\/engagement\/([0-9a-f-]{36})\/(archive|rolling)\/(.+)$/.exec(
    key,
  );
  if (m) return { kind: `engagement-${m[3]}`, tenantId: m[1], engagementId: m[2], leaf: m[4] };
  m = /^tenant\/([0-9a-f-]{36})\/full\/(\d{4})\/(.+)$/.exec(key);
  if (m) return { kind: "tenant-full", tenantId: m[1], leaf: m[3] };
  m = /^db\/(daily|weekly|monthly|yearly)\/(.+)$/.exec(key);
  if (m) return { kind: "db", class: m[1], leaf: m[2] };
  m = /^drill\/(.+)$/.exec(key);
  if (m) return { kind: "drill", leaf: m[1] };
  return null;
}
