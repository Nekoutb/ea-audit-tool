/**
 * The user's own text for working-paper fields a colleague changed while they
 * were typing (UAT run 3 firm.perf-concurrent). savePaper saves every other
 * field and holds these back; the save action keeps them in a short-lived,
 * path-scoped cookie and the task page puts them back into the form with a
 * banner, so nothing typed is lost and the user merges by hand.
 */

import { procKey, ynKey, ynWhyKey, type PaperDef } from "@/lib/papers/types";

/** Cookie name for one task's held-back fields. */
export function paperDraftCookie(itemId: string): string {
  return `wp-draft-${itemId.replace(/[^0-9a-f-]/gi, "")}`;
}

/** Browsers keep ~4 KB per cookie: stay well under it. */
const MAX_ENCODED = 3600;

export function encodePaperDraft(drafts: Record<string, string>): { value: string; truncated: boolean } {
  const work = { ...drafts };
  let truncated = false;
  let value = Buffer.from(JSON.stringify(work), "utf8").toString("base64url");
  while (value.length > MAX_ENCODED) {
    // shorten the longest text until it fits; the banner says so
    const longest = Object.keys(work).sort((a, b) => work[b].length - work[a].length)[0];
    if (!longest || work[longest].length === 0) break;
    work[longest] = work[longest].slice(0, Math.floor(work[longest].length * 0.7));
    truncated = true;
    value = Buffer.from(JSON.stringify({ ...work, __truncated: "1" }), "utf8").toString("base64url");
  }
  return { value, truncated };
}

export function decodePaperDraft(raw: string | undefined): { drafts: Record<string, string>; truncated: boolean } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const drafts: Record<string, string> = {};
    let truncated = false;
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (k === "__truncated") truncated = true;
      else if (typeof v === "string") drafts[k] = v;
    }
    return Object.keys(drafts).length > 0 ? { drafts, truncated } : null;
  } catch {
    return null;
  }
}

/** A field's label in the reader's language, for the conflict banner. */
export function paperFieldLabel(def: PaperDef, key: string, fr: boolean): string {
  if (key === "key_findings") return fr ? "Constats clés" : "Key findings";
  for (const f of def.fields ?? []) if (f.key === key) return fr ? f.labelFr : f.labelEn;
  for (const s of def.sections ?? []) {
    if (s.kind === "fields") {
      for (const f of s.fields) if (f.key === key) return fr ? f.labelFr : f.labelEn;
    } else if (s.kind === "proc") {
      for (const p of s.procs) if (procKey(p.key) === key) return fr ? p.fr : p.en;
    } else {
      for (const it of s.items) {
        if (ynKey(it.key) === key) return fr ? it.fr : it.en;
        if (ynWhyKey(it.key) === key) return `${fr ? it.fr : it.en} — ${fr ? "explication" : "explanation"}`;
      }
    }
  }
  const concl = /^c_(\d+)(_x)?$/.exec(key);
  if (concl) {
    const text = (fr ? def.conclFr : def.conclEn)?.[Number(concl[1])];
    if (text) return concl[2] ? `${text} — ${fr ? "explication" : "explanation"}` : text;
  }
  return key;
}
