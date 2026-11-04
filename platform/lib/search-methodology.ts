// The static half of the search (F079): "ISA 700", "DSF", "265" live in the paper
// definitions and the file index, in code, where a database search cannot see
// them. This builds one in-memory index per language, once per process.

import { DEFAULT_FILE_INDEX } from "@/lib/file-index";
import { paperFor } from "@/lib/working-papers";

/** Lower-case, no accents, "ISA 260/265" splits into ISA, 260 and 265. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.¶]+/g, " ")
    .trim();
}

interface Entry {
  code: string;
  title: string;
  text: string;
  /** the pieces shown as the snippet of a hit */
  pieces: string[];
}

const INDEX: Partial<Record<"en" | "fr", Entry[]>> = {};

function build(locale: "en" | "fr"): Entry[] {
  const fr = locale === "fr";
  return DEFAULT_FILE_INDEX.map((item) => {
    // SA: the fullest form, every procedure restricted to a legal form is in it or its neighbours
    const def = paperFor(item.code, "current", "SA");
    const pieces: string[] = [def.std, ...((fr ? def.reqFr : def.reqEn) ?? [])];
    for (const section of def.sections ?? []) {
      if (section.kind === "proc") {
        for (const p of section.procs) pieces.push(fr ? p.fr : p.en, fr ? p.srcFr : p.srcEn);
      } else if (section.kind === "yn") {
        for (const q of section.items) pieces.push(fr ? q.fr : q.en);
      }
    }
    const title = fr ? item.titleFr : item.titleEn;
    return { code: item.code, title, pieces, text: normalizeSearchText([item.code, title, ...pieces].join(" ")) };
  });
}

/** Every term present as a whole word (or a number inside a reference): code → title and snippet. */
export function methodologyMatches(query: string, locale: "en" | "fr"): Map<string, { title: string; snippet: string }> {
  const terms = normalizeSearchText(query).split(" ").filter((t) => t.length >= 2);
  const out = new Map<string, { title: string; snippet: string }>();
  if (terms.length === 0) return out;
  const entries = (INDEX[locale] ??= build(locale));
  const matchers = terms.map((t) => new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.¶]/g, "\\$&")}(?:$|[^a-z0-9])`));
  for (const entry of entries) {
    if (!matchers.every((m) => m.test(entry.text))) continue;
    const piece = entry.pieces.find((p) => matchers.every((m) => m.test(normalizeSearchText(p)))) ?? entry.pieces[0] ?? "";
    out.set(entry.code, { title: `${entry.code} — ${entry.title}`, snippet: piece.length > 180 ? `${piece.slice(0, 178)}…` : piece });
  }
  return out;
}
