// One-shot codemod: give every placeholder-only input an aria-label mirroring
// its placeholder (audit W1 — a placeholder is not a label).
import fs from "node:fs";

const EDITS = [
  ["app/engagements/[id]/planning/page.tsx", [
    ['<input name="grade" placeholder={tp.budget.grade}', '<input name="grade" placeholder={tp.budget.grade} aria-label={tp.budget.grade}'],
    ['<input name="hours" type="number" step="0.5" min="0" placeholder={tp.budget.hours}', '<input name="hours" type="number" step="0.5" min="0" placeholder={tp.budget.hours} aria-label={tp.budget.hours}'],
    ['<input name="title" placeholder={tp.pbc.itemTitle}', '<input name="title" placeholder={tp.pbc.itemTitle} aria-label={tp.pbc.itemTitle}'],
  ]],
  ["app/engagements/[id]/legal/page.tsx", [
    ["placeholder={tl.faitDescription}", "placeholder={tl.faitDescription} aria-label={tl.faitDescription}"],
    ['<textarea name="points" rows={2} required placeholder={tl.points}', '<textarea name="points" rows={2} required placeholder={tl.points} aria-label={tl.points}'],
  ]],
  ["app/engagements/[id]/discussion/page.tsx", [
    ['<input name="body" required placeholder={labels.replyPlaceholder}', '<input name="body" required placeholder={labels.replyPlaceholder} aria-label={labels.replyPlaceholder}'],
    ['<textarea name="body" required rows={3} placeholder={tc.placeholder}', '<textarea name="body" required rows={3} placeholder={tc.placeholder} aria-label={tc.placeholder}'],
  ]],
  ["app/engagements/[id]/forms/[code]/page.tsx", [
    ['<input name="name" placeholder="Nom / Name"', '<input name="name" placeholder="Nom / Name" aria-label="Nom / Name"'],
    ['<input name="relationship" placeholder="Relation"', '<input name="relationship" placeholder="Relation" aria-label="Relation"'],
    ['<input name="notes" placeholder="Notes"', '<input name="notes" placeholder="Notes" aria-label="Notes"'],
    ['<input name="nature" placeholder="Nature"', '<input name="nature" placeholder="Nature" aria-label="Nature"'],
    ['<input name="method" placeholder="Méthode / Method"', '<input name="method" placeholder="Méthode / Method" aria-label="Méthode / Method"'],
    ['<input name="uncertainty" placeholder="Incertitude / Uncertainty"', '<input name="uncertainty" placeholder="Incertitude / Uncertainty" aria-label="Incertitude / Uncertainty"'],
    ["placeholder={tp.riskDescription}", "placeholder={tp.riskDescription} aria-label={tp.riskDescription}"],
  ]],
];

for (const [file, pairs] of EDITS) {
  let src = fs.readFileSync(file, "utf8");
  let n = 0;
  for (const [from, to] of pairs) {
    if (src.includes(to)) continue; // already labelled
    if (src.includes(from)) { src = src.split(from).join(to); n++; }
    else console.log("NOT FOUND in " + file + ": " + from.slice(0, 50));
  }
  fs.writeFileSync(file, src);
  console.log(file + ": " + n + " labels added");
}
