// White-label phase 1 (spec §2.2): per-firm branding — display name, accent
// colour, logo, and the letterhead block stamped on every generated document.
// The UI theme works by overriding Tailwind v4's emerald CSS variables at the
// root, so no component changes are needed; the accent supplied by the firm
// is used verbatim as the 700 shade (primary buttons) and the rest of the
// scale is derived from its hue.

import type { PoolClient } from "pg";
import { DEFAULT_ENGAGEMENT_NAMING } from "@/lib/complexity";
import { withTenant } from "@/lib/db";
import type { Branding } from "@/lib/letterhead";
import { canManageFirm } from "@/lib/rbac";
import { requirePortalUser, requireTenant, requireWrite } from "@/lib/tenant";

// The Branding shape and the .docx letterhead builders are pure and live in
// lib/letterhead.ts, so document generators (lib/docx.ts) can render a
// letterhead without this module's session/database dependencies.
export { letterheadFooter, letterheadParagraphs, type Branding } from "@/lib/letterhead";

export class BrandingError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "BrandingError";
  }
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const LOGO_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
// Must accommodate a full 150 KB upload once base64-encoded (+ data-URI prefix).
const MAX_LOGO_CHARS = 210_000;
const MAX_TEXT = 160;

/**
 * Tailwind's emerald-700 — the platform's primary. The settings colour picker
 * shows it as the placeholder, and saving it is normalized back to "no custom
 * accent" so an untouched picker never pins the firm to a derived palette.
 */
export const DEFAULT_ACCENT = "#047857";

interface BrandingRow {
  name: string;
  branding: Partial<Branding> | null;
}

/** Default engagement naming convention (see lib/complexity.ts). */
const DEFAULT_NAMING = DEFAULT_ENGAGEMENT_NAMING;

function merge(row: BrandingRow): Branding {
  const stored = row.branding ?? {};
  return {
    displayName: typeof stored.displayName === "string" && stored.displayName.trim() ? stored.displayName : row.name,
    accent: typeof stored.accent === "string" && HEX_RE.test(stored.accent) ? stored.accent : null,
    logo: typeof stored.logo === "string" && LOGO_RE.test(stored.logo) ? stored.logo : null,
    letterhead1: typeof stored.letterhead1 === "string" ? stored.letterhead1 : "",
    letterhead2: typeof stored.letterhead2 === "string" ? stored.letterhead2 : "",
    footer: typeof stored.footer === "string" ? stored.footer : "",
    engagementNaming:
      typeof stored.engagementNaming === "string" && stored.engagementNaming.trim()
        ? stored.engagementNaming
        : DEFAULT_NAMING,
  };
}

/** Branding merged with defaults, inside an existing transaction. */
export async function loadBranding(tx: PoolClient, tenantId: string): Promise<Branding> {
  const result = await tx.query<BrandingRow>(
    "SELECT name, branding FROM tenant WHERE id = $1",
    [tenantId],
  );
  if (!result.rows[0]) throw new BrandingError("not-found");
  return merge(result.rows[0]);
}

export async function getBranding(): Promise<Branding> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => loadBranding(tx, tenantId));
}

/**
 * The firm's branding as its client portal shows it. `requireTenant()` refuses
 * portal accounts by design (it is the boundary between a client_user and the
 * audit file), so the portal page cannot go through `getBranding()` — it did,
 * and every portal visit threw `ForbiddenError: portal-account`. The firm's
 * name, logo and colours are the one piece of firm data a client is meant to
 * see; nothing else is read here.
 */
export async function getPortalBranding(): Promise<Branding> {
  const { tenantId } = await requirePortalUser();
  return withTenant(tenantId, (tx) => loadBranding(tx, tenantId));
}

/** Firm-admin only. Writes are always scoped to the SESSION tenant. */
export async function updateBranding(patch: {
  displayName?: string;
  accent?: string;
  logo?: string | null;
  letterhead1?: string;
  letterhead2?: string;
  footer?: string;
  engagementNaming?: string;
}): Promise<void> {
  const { tenantId, role } = await requireWrite();
  if (!canManageFirm(role)) throw new BrandingError("forbidden");

  if (patch.accent !== undefined && patch.accent !== "") {
    accentShades(patch.accent); // full validation incl. the readability guard
  }
  if (patch.logo != null && patch.logo !== "") {
    if (!LOGO_RE.test(patch.logo)) throw new BrandingError("invalid-logo-type");
    if (patch.logo.length > MAX_LOGO_CHARS) throw new BrandingError("logo-too-large");
  }
  for (const key of ["displayName", "letterhead1", "letterhead2", "footer", "engagementNaming"] as const) {
    const value = patch[key];
    if (typeof value === "string" && value.length > MAX_TEXT) throw new BrandingError("text-too-long");
  }

  const stored: Record<string, unknown> = {};
  if (patch.displayName !== undefined) stored.displayName = patch.displayName.trim();
  if (patch.accent !== undefined) {
    const accent = patch.accent.toLowerCase();
    stored.accent = accent === "" || accent === DEFAULT_ACCENT ? null : accent;
  }
  if (patch.logo !== undefined) stored.logo = patch.logo === "" ? null : patch.logo;
  if (patch.letterhead1 !== undefined) stored.letterhead1 = patch.letterhead1.trim();
  if (patch.letterhead2 !== undefined) stored.letterhead2 = patch.letterhead2.trim();
  if (patch.footer !== undefined) stored.footer = patch.footer.trim();
  if (patch.engagementNaming !== undefined) {
    const naming = patch.engagementNaming.trim();
    stored.engagementNaming = naming === "" || naming === DEFAULT_NAMING ? null : naming;
  }

  await withTenant(tenantId, async (tx) => {
    await tx.query(
      "UPDATE tenant SET branding = branding || $2::jsonb WHERE id = $1",
      [tenantId, JSON.stringify(stored)],
    );
  });
}

// ---- accent → Tailwind emerald-scale override ----

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = (p: number, q: number, t: number): number => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const to = (v: number): string => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export const ACCENT_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const LIGHTER = [50, 100, 200, 300, 400, 500, 600];
const DARKER = [800, 900, 950];

/**
 * Full 50–950 scale from one accent; the accent itself IS the 700 shade
 * (the primary-button colour). The ladder is anchored to the accent's OWN
 * lightness — lighter shades interpolate toward near-white, darker toward
 * near-black — so it stays monotonic for any accent. Accents too light to
 * carry white button text (or nearly black) are rejected.
 */
/** WCAG relative luminance of a #rrggbb colour. */
function relativeLuminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio of the colour against white — what button text sits on. */
export function contrastAgainstWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

/**
 * The floor for white text on the accent (buttons, links on white). 3:1 is
 * WCAG AA for large/bold text; pure yellow (#ffff00) sits at 1.07:1 and made
 * buttons and links almost invisible (UAT B116). The HSL lightness guard let
 * it through because yellow is "light" only in luminance, not in HSL.
 */
const MIN_CONTRAST = 3;

export function accentShades(accent: string): Record<number, string> {
  if (!HEX_RE.test(accent)) throw new BrandingError("invalid-color");
  const { h, s, l } = hexToHsl(accent);
  if (l > 0.8 || l < 0.08) throw new BrandingError("invalid-color");
  if (contrastAgainstWhite(accent) < MIN_CONTRAST) throw new BrandingError("invalid-color");
  const scale: Record<number, string> = { 700: accent.toLowerCase() };
  LIGHTER.forEach((shade, index) => {
    const towardWhite = (LIGHTER.length - index) / (LIGHTER.length + 1); // 50 → 7/8 … 600 → 1/8
    scale[shade] = hslToHex(h, s, l + (0.97 - l) * towardWhite);
  });
  DARKER.forEach((shade, index) => {
    const towardBlack = (index + 1) / (DARKER.length + 1); // 800 → 1/4 … 950 → 3/4
    scale[shade] = hslToHex(h, s, l * (1 - towardBlack) + 0.05 * towardBlack);
  });
  return scale;
}

/** CSS-variable overrides applied at :root (Tailwind v4 utilities use var()). */
export function accentCss(accent: string): string {
  const scale = accentShades(accent);
  const vars = ACCENT_SHADES.map((shade) => `--color-emerald-${shade}: ${scale[shade]};`).join(" ");
  return `:root { ${vars} }`;
}
