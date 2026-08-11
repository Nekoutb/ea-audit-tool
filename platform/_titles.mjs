// One-shot codemod: add static page titles (audit C4). Inserts an
// `export const metadata` after the import block of each listed page.
import fs from "node:fs";

const MAP = {
  "app/dashboard/page.tsx": "Firm dashboard",
  "app/clients/page.tsx": "Clients",
  "app/clients/[id]/page.tsx": "Client",
  "app/engagements/page.tsx": "Engagements",
  "app/new-engagement/page.tsx": "New engagement",
  "app/users/page.tsx": "Users",
  "app/templates/page.tsx": "Templates",
  "app/resources/page.tsx": "Team workload",
  "app/settings/page.tsx": "Settings",
  "app/notifications/page.tsx": "Notifications",
  "app/engagements/[id]/dashboard/page.tsx": "Engagement dashboard",
  "app/engagements/[id]/page.tsx": "Audit file",
  "app/engagements/[id]/acceptance/page.tsx": "Acceptance & continuance",
  "app/engagements/[id]/planning/page.tsx": "Planning",
  "app/engagements/[id]/risks/page.tsx": "Risk register",
  "app/engagements/[id]/data/page.tsx": "Data",
  "app/engagements/[id]/analytics/page.tsx": "Analytics",
  "app/engagements/[id]/findings/page.tsx": "Findings",
  "app/engagements/[id]/confirmations/page.tsx": "Confirmations",
  "app/engagements/[id]/pbc/page.tsx": "PBC requests",
  "app/engagements/[id]/legal/page.tsx": "OHADA legal",
  "app/engagements/[id]/conclusion/page.tsx": "Conclusion",
  "app/engagements/[id]/time/page.tsx": "Time",
  "app/engagements/[id]/activity/page.tsx": "Activity",
  "app/engagements/[id]/discussion/page.tsx": "Discussion",
  "app/documents/[id]/page.tsx": "Working paper",
};

let done = 0;
for (const [file, title] of Object.entries(MAP)) {
  let src;
  try { src = fs.readFileSync(file, "utf8"); } catch { console.log("MISSING " + file); continue; }
  if (/export const metadata|generateMetadata/.test(src)) { console.log("SKIP (has metadata) " + file); continue; }
  const lines = src.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import /.test(lines[i])) lastImport = i;
    // multi-line imports: advance to the closing line
    if (/^import /.test(lines[i]) && !/;\s*$/.test(lines[i])) {
      while (i < lines.length - 1 && !/;\s*$/.test(lines[i])) i++;
      lastImport = i;
    }
  }
  if (lastImport < 0) { console.log("NO IMPORTS " + file); continue; }
  lines.splice(lastImport + 1, 0, "", `export const metadata = { title: "${title} · AuditISA" };`);
  fs.writeFileSync(file, lines.join("\n"));
  done++;
}
console.log("titled " + done + " pages");
