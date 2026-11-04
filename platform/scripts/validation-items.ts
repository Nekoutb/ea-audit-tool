// The items the firm or its jurist must validate before they leave DEV (decision
// 2026-10-27, VALIDATION): every draft French tip ("[Projet]") and every legal
// article or deadline marked "(à valider)", read from the paper definitions and
// from the other sources that state them, so nothing is missed.
//
//   npx tsx scripts/validation-items.ts <output.json>
//
// scripts/validation-workbook.py turns the JSON into the Excel review workbook.

import { readFileSync, writeFileSync } from "node:fs";
import Module from "node:module";
import path from "node:path";

// lib/working-papers reaches the session and database layers, which a read of the
// paper definitions never calls: answer those imports with empty modules.
type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;
const loader = Module as unknown as { _load: Loader };
const realLoad = loader._load;
loader._load = function load(request, parent, isMain) {
  if (request === "@/auth" || request.startsWith("next-auth") || request.startsWith("next/")) return { auth: async () => null };
  return realLoad.call(this, request, parent, isMain);
};
// the pool is created on import and never used here
process.env.DATABASE_URL ??= "postgres://unused.invalid/none";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DEFAULT_FILE_INDEX } = require("../lib/file-index") as typeof import("../lib/file-index");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { paperFor } = require("../lib/working-papers") as typeof import("../lib/working-papers");

export interface ValidationItem {
  kind: "tip" | "article";
  paper: string;
  item: string;
  text: string;
  source: string;
}

const MARK = /à valider/i;
const ARTICLE = /(?:AUSCGIE |AUDCIF |SA |SARL |SAS )?(?:arts?\.?|articles?)\s*\d[\d\s,/–\-.et]*(?:\d|bis)/gi;

const articlesIn = (text: string): string => [...new Set(text.match(ARTICLE)?.map((a) => a.trim()) ?? [])].join(" ; ");

/**
 * Every paper under every legal form, because a procedure restricted to one form
 * (F052) exists only there. The same field is listed once, in its first wording,
 * SA first: an organ's name changing with the form is not another legal question.
 */
const FORMS = ["SA", "SA_AG", "SARL", "SAS", "GIE", "OTHER"] as const;

function fromPapers(): ValidationItem[] {
  const out: ValidationItem[] = [];
  const seenField = new Set<string>();
  for (const entry of DEFAULT_FILE_INDEX) {
    const paper = `${entry.code} ${entry.titleFr}`;
    const once = (field: string) => {
      const id = `${entry.code}|${field}`;
      if (seenField.has(id)) return false;
      seenField.add(id);
      return true;
    };
    for (const form of FORMS) {
      const def = paperFor(entry.code, "current", form);
      const mark = (field: string, item: string, text: string | undefined, source = "") => {
        if (text && MARK.test(text) && once(field)) out.push({ kind: "article", paper, item, text, source: articlesIn(`${text} ${source}`) || source });
      };
      const tip = (field: string, item: string, text: string, source: string) => {
        if (once(field)) out.push({ kind: "tip", paper, item, text, source: articlesIn(`${text} ${source}`) || source });
      };
      mark("std", "Norme de la feuille", def.std);
      mark("owns", "Objet de la feuille", def.ownsFr);
      (def.reqFr ?? []).forEach((text, i) => mark(`req${i}`, `Exigence ${i + 1}`, text, def.std));
      (def.conclFr ?? []).forEach((text, i) => mark(`concl${i}`, `Conclusion ${i + 1}`, text));
      for (const section of def.sections ?? []) {
        const sectionTitle = section.titleFr;
        mark(`intro|${sectionTitle}`, `${sectionTitle} (introduction)`, section.introFr);
        if (section.kind === "proc") {
          for (const proc of section.procs) {
            const item = `${sectionTitle} / ${proc.fr}`;
            if (proc.tipFr?.includes("[Projet]")) tip(`ptip|${proc.key}`, item, proc.tipFr, proc.srcFr);
            else mark(`ptip|${proc.key}`, `${item} (conseil)`, proc.tipFr, proc.srcFr);
            mark(`p|${proc.key}`, `${sectionTitle} / Procédure ${proc.key}`, proc.fr, proc.srcFr);
            mark(`psrc|${proc.key}`, `${item} (sources)`, proc.srcFr);
          }
        } else if (section.kind === "yn") {
          for (const q of section.items) {
            const item = `${sectionTitle} / ${q.fr}`;
            if (q.tipFr?.includes("[Projet]")) tip(`qtip|${q.key}`, item, q.tipFr, "");
            else mark(`qtip|${q.key}`, `${item} (conseil)`, q.tipFr);
            mark(`q|${q.key}`, `${sectionTitle} / Question ${q.key}`, q.fr);
          }
        }
      }
    }
  }
  return out;
}

/** The lines outside the papers that carry the mark: the legal engine, the alert procedure, the screens. */
function fromSources(root: string): ValidationItem[] {
  const out: ValidationItem[] = [];
  const paperOf: Record<string, string> = {
    "lib/alerte.ts": "C5.5 Procédure d'alerte",
    "lib/legal.ts": "Dossier légal (C5.x)",
    "lib/legal-forms.ts": "Formes juridiques",
    "messages/fr.json": "Écrans (messages)",
    "app/engagements/[id]/legal/page.tsx": "Dossier légal (écran)",
  };
  for (const relative of Object.keys(paperOf)) {
    const lines = readFileSync(path.join(root, relative), "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!MARK.test(line)) return;
      const text = line
        .replace(/^\s*(?:\/\/|\/\*\*?|\*|\{\/\*)\s*/, "")
        .replace(/\*\/\}?\s*$/, "")
        .trim();
      // a line that names no article is a note about the mark, not a legal reading
      if (articlesIn(text)) out.push({ kind: "article", paper: paperOf[relative], item: `${relative}:${i + 1}`, text, source: articlesIn(text) });
    });
  }
  return out;
}

/** The two readings the firm asked to see by name, marked in the text or not. */
function named(): ValidationItem[] {
  return [
    {
      kind: "article",
      paper: "C5.5 Procédure d'alerte",
      item: "Délai de première réponse à la demande d'explication",
      text: "Le dirigeant répond à la demande d'explication du commissaire aux comptes dans le délai d'un mois à compter de sa réception (lecture de l'AUSCGIE révisé de 2014). L'Acte de 1997 prévoyait quinze jours. L'outil calcule l'échéance sur un mois.",
      source: "AUSCGIE arts. 150 (gérant) et 153 (PCA, PDG ou administrateur général) ; lib/alerte.ts FIRST_REPLY_DAYS",
    },
    {
      kind: "article",
      paper: "C5.3 Conventions réglementées",
      item: "SA avec administrateur général (SA_AG) : autorité qui autorise les conventions",
      text: "Dans la SA avec administrateur général, sans conseil d'administration, les conventions réglementées sont soumises à l'assemblée générale. L'outil applique cette lecture des articles 502 et 503 et le rapport spécial la cite.",
      source: "AUSCGIE arts. 502–503 ; lib/legal.ts, lib/papers/conclusion.ts (authorisation_ag)",
    },
  ];
}

const root = path.resolve(__dirname, "..");
const destination = process.argv[2];
if (!destination) throw new Error("usage: validation-items.ts <output.json>");
const items = [...fromPapers(), ...fromSources(root), ...named()];
// one row per identical text in one place
const seen = new Set<string>();
const unique = items.filter((it) => {
  const key = `${it.kind}|${it.paper}|${it.text}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
writeFileSync(destination, JSON.stringify(unique, null, 1), "utf8");
console.log(`${unique.filter((i) => i.kind === "tip").length} tips, ${unique.filter((i) => i.kind === "article").length} articles`);
