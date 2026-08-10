// The standard working-paper template: a Word document generated from the
// paper's own definition — guidance, procedures with source lines, the
// questionnaire and the conclusion — so every engagement starts from the same
// form the console displays. Attached automatically to each task's Forms box;
// edits flow back through the attachment watcher like any other file.

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { PaperDef } from "@/lib/papers/types";

export const STANDARD_TEMPLATE_NAME = (code: string) => `${code} — Standard working paper.docx`;
export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function renderPaperTemplate(
  code: string,
  title: string,
  def: PaperDef,
  locale: "en" | "fr",
): Promise<Buffer> {
  const fr = locale === "fr";
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${code} — ${title}`)] }),
    new Paragraph({ children: [new TextRun({ text: def.std, italics: true })] }),
    new Paragraph({ children: [new TextRun({ text: fr ? `Enregistre : ${def.ownsFr}` : `Records: ${def.ownsEn}`, size: 20 })] }),
    new Paragraph({ text: "" }),
  ];
  const req = (fr ? def.reqFr : def.reqEn) ?? [];
  if (req.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(fr ? "Ce que les normes exigent" : "What the standards require")] }));
    for (const r of req) children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(r)] }));
    children.push(new Paragraph({ text: "" }));
  }
  for (const s of def.sections ?? []) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(fr ? s.titleFr : s.titleEn)] }));
    const intro = fr ? s.introFr : s.introEn;
    if (intro) children.push(new Paragraph({ children: [new TextRun({ text: intro, italics: true })] }));
    if (s.kind === "proc") {
      s.procs.forEach((p, i) => {
        children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${fr ? p.fr : p.en}` })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: (fr ? "Sources attendues : " : "Expected sources: ") + (fr ? p.srcFr : p.srcEn), size: 18, color: "666666" })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: fr ? "Résultat : " : "Result: " }), new TextRun({ text: "____________________________________________" })] }));
      });
    } else if (s.kind === "yn") {
      s.items.forEach((it, i) => {
        children.push(new Paragraph({ children: [new TextRun(`${i + 1}. ${fr ? it.fr : it.en}`)] }));
        children.push(new Paragraph({ children: [new TextRun({ text: `☐ ${fr ? "Oui" : "Yes"}   ☐ ${fr ? "Non" : "No"}${it.na ? `   ☐ ${fr ? "S.O." : "N/A"}` : ""}   ${fr ? "Motif si « Non » : " : "Reason if No: "}________________` })] }));
      });
    } else {
      for (const f of s.fields) {
        const label = fr ? f.labelFr : f.labelEn;
        if (f.kind === "select") {
          children.push(new Paragraph({ children: [new TextRun(`${label}: ${(f.options ?? []).map((o) => `☐ ${fr ? o.fr : o.en}`).join("   ")}`)] }));
        } else {
          children.push(new Paragraph({ children: [new TextRun(`${label}: `), new TextRun("____________________________________________")] }));
        }
      }
    }
    children.push(new Paragraph({ text: "" }));
  }
  const concl = (fr ? def.conclFr : def.conclEn) ?? [];
  if (concl.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Conclusion")] }));
    for (const c of concl) {
      children.push(new Paragraph({ children: [new TextRun(c)] }));
      children.push(new Paragraph({ children: [new TextRun(`☐ ${fr ? "Oui" : "Yes"}   ☐ ${fr ? "Non" : "No"}`)] }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
