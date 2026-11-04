// The trail stores its summaries in English, as written; a French reader reads them in French (F086).

import { editionLabel, isStandardsEdition } from "@/lib/standards-edition";

/**
 * The trail stores its summaries in English; the materiality lines are
 * rendered in the reader's language (UAT B127: "Materiality v3 approved").
 */
export function localizedSummary(summary: string, locale: string): string {
  const lang = locale === "fr" ? "fr" : "en";
  // the answer-history trigger's line carries storage keys, which mean nothing to a reader (F086)
  const answer = /^(?:[a-z]+:)?(\S+) · \S+ (changed|cleared)$/.exec(summary);
  if (answer) {
    const done = answer[2] === "changed";
    return lang === "fr"
      ? `${answer[1]} : réponse ${done ? "modifiée" : "effacée"}`
      : `${answer[1]}: answer ${done ? "changed" : "cleared"}`;
  }
  // the edition is stored as its key; the reader gets its label, in either language (F086)
  summary = summary.replace(
    /^Standards edition changed from (\S+) to (\S+):/,
    (_, from: string, to: string) => `Standards edition changed from ${isStandardsEdition(from) ? editionLabel(from, lang) : from} to ${isStandardsEdition(to) ? editionLabel(to, lang) : to}:`,
  );
  if (locale !== "fr") return summary;
  const m = /^Materiality v(\d+) (created|revised|approved)$/.exec(summary);
  if (m) {
    const verb = m[2] === "created" ? "créé" : m[2] === "revised" ? "révisé" : "approuvé";
    return `Seuil de signification v${m[1]} ${verb}`;
  }
  // the team, assignment, sign-off and evidence lines (UAT run 3 B14);
  // anything unrecognised is shown as stored
  const role = (r: string) =>
    (({
      partner: "associé",
      manager: "manager",
      senior: "senior",
      staff: "assistant",
      "eqr reviewer": "réviseur qualité (EQR)",
      eqr: "réviseur qualité (EQR)",
      preparer: "préparateur",
      reviewer: "réviseur",
    }) as Record<string, string>)[r] ?? r;
  const rules: [RegExp, (g: string[]) => string][] = [
    [/^(.+) removed from the team \((.+)\)$/, (g) => `${g[1]} retiré(e) de l'équipe (${role(g[2])})`],
    [/^(\S+) unassigned \((.+) left the team\)$/, (g) => `${g[1]} désassignée (${g[2]} a quitté l'équipe)`],
    [/^(\S+) assigned$/, (g) => `${g[1]} assignée`],
    [/^(\S+) unassigned$/, (g) => `${g[1]} désassignée`],
    [/^(\S+ )?signed off as (\w+)( \(signed by non-assignee\))?$/, (g) => `${g[1] ?? ""}signé comme ${role(g[2])}${g[3] ? " (signé par un non-assigné)" : ""}`],
    [/^(\w+) sign-off on (\S+) voided — the paper was edited after signing$/, (g) => `Signature ${role(g[1])} sur ${g[2]} annulée — le document a été modifié après signature`],
    [/^Attachment (uploaded|deleted|restored): (.+)$/, (g) => `Pièce jointe ${({ uploaded: "déposée", deleted: "supprimée", restored: "restaurée" } as Record<string, string>)[g[1]]} : ${g[2]}`],
    [/^Attachment renamed (.+) → (.+)$/, (g) => `Pièce jointe renommée ${g[1]} → ${g[2]}`],
    [/^Deleted: (.+) \(restorable for (\d+) days\)$/, (g) => `Supprimé : ${g[1]} (restaurable pendant ${g[2]} jours)`],
    [/^Independence confirmation signed by (.+) — (completed|exception)$/, (g) => `Confirmation d'indépendance signée par ${g[1]} — ${g[2] === "exception" ? "exception" : "sans exception"}`],
    [/^S5\.5 (\S+) (\S+) changed$/, (g) => `S5.5 ${g[1]} ${g[2]} modifié`],
    // the remaining common entries (UAT run 2 B24)
    [/^Engagement created$/, () => "Mission créée"],
    [/^Nature of entity concluded: (complex|non complex|very simple)(?: \(reason: (.+)\))?$/, (g) => `Nature de l'entité conclue : ${({ complex: "complexe", "non complex": "non complexe", "very simple": "très simple" } as Record<string, string>)[g[1]] ?? g[1]}${g[2] ? ` (motif : ${g[2]})` : ""}`],
    [/^Period end changed from (\S+) to (\S+)$/, (g) => `Date de clôture modifiée : ${g[1]} → ${g[2]}`],
    [/^Period end changed to (\S+)$/, (g) => `Date de clôture modifiée : ${g[1]}`],
    [/^Trial balance imported \((\w+), v(\d+), (.+)\) — (\w+)$/, (g) => `Balance importée (${g[1] === "pre_audit" ? "avant audit" : g[1] === "post_audit" ? "après audit" : g[1]}, v${g[2]}, ${g[3]}) — ${g[4] === "valid" ? "valide" : g[4] === "invalid" ? "invalide" : g[4]}`],
    [/^Restored: (.+)$/, (g) => `Restauré : ${g[1]}`],
    [/^Review note raised on (\S+)$/, (g) => `Note de revue émise sur ${g[1] === "task" ? "la tâche" : g[1]}`],
    [/^Review note on (\S+) (answered|cleared)$/, (g) => `Note de revue sur ${g[1] === "task" ? "la tâche" : g[1]} ${g[2] === "answered" ? "répondue" : "levée"}`],
    [/^(\S+) working paper generated \((.+)\)$/, (g) => `${g[1]} feuille de travail générée (${g[2]})`],
    // the keys travel in the stored line; the reader gets how many, not the storage names
    [/^(\S+) working paper saved — (.+)$/, (g) => `${g[1]} feuille de travail enregistrée — ${g[2].split(", ").length} champ(s)`],
    [/^(\S+) — ([a-z0-9_]+(?:, [a-z0-9_]+)*)$/, (g) => `${g[1]} enregistré — ${g[2].split(", ").length} champ(s)`],
    [/^(\S+) tasks instantiated$/, (g) => `Tâches ${g[1]} ajoutées`],
    [/^Due date set to (\S+)$/, (g) => `Échéance fixée au ${g[1]}`],
    [/^Due date cleared$/, () => "Échéance supprimée"],
    [/^Acceptance gates passed — engagement moved to planning$/, () => "Conditions d'acceptation remplies — mission passée en planification"],
    [/^Planning closed — snapshot taken, engagement moved to execution$/, () => "Planification clôturée — instantané pris, mission passée en exécution"],
    // every remaining line the trail writes (F086, D3)
    [/^Password changed$/, () => "Mot de passe modifié"],
    [/^Removed from firm$/, () => "Retiré(e) du cabinet"],
    [/^Two-factor disabled$/, () => "Double authentification désactivée"],
    [/^Two-factor enabled$/, () => "Double authentification activée"],
    [/^Firm sign-off policy updated$/, () => "Politique de signature du cabinet mise à jour"],
    [/^(.+) invited to the engagement$/, (g) => `${g[1]} invité(e) sur la mission`],
    [/^(\S+) saved & handed off$/, (g) => `${g[1]} enregistrée et transmise`],
    [/^(\S+) reopened while the engagement is in (\S+): the (\S+) gate is no longer satisfied$/, (g) => `${g[1]} rouverte alors que la mission est en ${g[2]} : la condition de ${g[3]} n'est plus remplie`],
    [/^(\S+) letter generated: (.+) \(v(\d+)\)$/, (g) => `${g[1]} lettre générée : ${g[2]} (v${g[3]})`],
    [/^(\d+) task\(s\) (assigned|unassigned) as (\w+): (.+)$/, (g) => `${g[1]} tâche(s) ${g[2] === "assigned" ? "assignée(s)" : "désassignée(s)"} comme ${role(g[3])} : ${g[4]}`],
    [/^(\w+) sign-off( on (.+?))?(: .*)?$/, (g) => `Signature ${role(g[1])}${g[3] ? ` sur ${g[3]}` : ""}${g[4] ?? ""}`],
    [/^CRA (\S+) reassessed: (.+)$/, (g) => `Évaluation combinée ${g[1]} réévaluée : ${g[2]}`],
    [/^Completion record (\S+) (updated|recorded)$/, (g) => `Élément d'achèvement ${g[1]} ${g[2] === "updated" ? "mis à jour" : "enregistré"}`],
    [/^Continuing engagement: prior file FY(\d+) linked, (\d+) field\(s\) carried forward$/, (g) => `Mission reconduite : dossier ${g[1]} lié, ${g[2]} champ(s) reporté(s)`],
    [/^Engagement partner transferred from (.+) to (.+?)( \(.*)?$/, (g) => `Associé de la mission transféré de ${g[1]} à ${g[2]}${g[3] ?? ""}`],
    [/^Exported (.+)$/, (g) => `Exporté : ${g[1]}`],
    [/^Firm audit log exported \((\d+) rows\)$/, (g) => `Journal d'audit du cabinet exporté (${g[1]} lignes)`],
    [/^Firm retention period set to (\d+) years$/, (g) => `Durée de conservation du cabinet fixée à ${g[1]} ans`],
    [/^ISA 265 deficiency evaluated on C5\.11: graded (\w+)(?:, communicated in writing on (\S+) to (.+))?$/, (g) => `Déficience ISA 265 évaluée en C5.11 : classée ${({ low: "faible", medium: "moyenne", high: "élevée", significant: "significative", deficiency: "déficience" } as Record<string, string>)[g[1]] ?? g[1]}${g[2] ? `, communiquée par écrit le ${g[2]} à ${g[3]}` : ""}`],
    // the lines the data migrations wrote, shown under "System"
    [/^C5\.11 Communications \(ISA 260\/265\) created next to C5\.1, retitled Opinion and auditor's report \(ISA 700–706\): (\d+) letter\(s\) and (\d+) finding\(s\) moved from C5\.1 to C5\.11$/, (g) => `C5.11 Communications (ISA 260/265) créée à côté de C5.1, retitrée Opinion et rapport de l'auditeur (ISA 700–706) : ${g[1]} lettre(s) et ${g[2]} constat(s) déplacés de C5.1 vers C5.11`],
    [/^E4\.36 Cash Flow \(TFT\) Tie-out added: core paper on every file \(F047, firm decision 2026-10-27\)$/, () => "E4.36 Rapprochement du TFT ajoutée : feuille de base de tout dossier (F047, décision du cabinet du 27/10/2026)"],
    [/^C5\.7 Registered Securities Register Attestation marked conditional: a (\S+) issues no titres nominatifs \(F052, firm decision 2026-10-27\)$/, (g) => `C5.7 Attestation du registre des titres rendue conditionnelle : une ${g[1]} n'émet pas de titres nominatifs (F052, décision du cabinet du 27/10/2026)`],
    [/^Engagement partner designated by data migration: (.+)$/, (g) => `Associé de la mission désigné par reprise de données : ${g[1]}`],
    [/^Invitation re-sent to (.+)$/, (g) => `Invitation renvoyée à ${g[1]}`],
    [/^Invited (.+) \((.+)\)$/, (g) => `${g[1]} invité(e) (${role(g[2])})`],
    [/^Legal hold placed — retention expiry suspended\. Reason: (.+)$/, (g) => `Conservation légale posée, échéance suspendue. Motif : ${g[1]}`],
    [/^Legal hold released — retention expiry resumes\. Reason: (.+)$/, (g) => `Conservation légale levée, l'échéance reprend. Motif : ${g[1]}`],
    [/^Logged ([\d.]+)h$/, (g) => `${g[1]} h saisies`],
    [/^Password reset for (.+)$/, (g) => `Mot de passe réinitialisé pour ${g[1]}`],
    [/^Presumed revenue-fraud risk rebutted: (.+)$/, (g) => `Risque présumé de fraude sur les produits réfuté : ${g[1]}`],
    [/^Reopened ?(.*?): (.+)$/, (g) => `Rouvert ${g[1]} : ${g[2]}`],
    [/^Report issued \((.+)\) dated (\S+)$/, (g) => `Rapport émis (${g[1]}) daté du ${g[2]}`],
    [/^Reporting framework \/ planned AGM date changed to (.+) \/ (.+)$/, (g) => `Référentiel / date prévue de l'AGO modifiés : ${g[1]} / ${g[2]}`],
    [/^Restored v(\d+) as v(\d+)(?: on (.+))?$/, (g) => `v${g[1]} restaurée en v${g[2]}${g[3] ? ` sur ${g[3]}` : ""}`],
    [/^Role changed to (.+)$/, (g) => `Rôle modifié : ${role(g[1])}`],
    [/^Section conclusion review on (\S+) cleared — the reviewer sign-off was voided$/, (g) => `Revue de conclusion sur ${g[1]} levée : la signature du réviseur a été annulée`],
    [/^Sign-off rules updated for (\d+) task\(s\): (.+)$/, (g) => `Règles de signature mises à jour pour ${g[1]} tâche(s) : ${g[2]}`],
    [/^Sign-offs voided(?: on (.+?))?: (.+)$/, (g) => `Signatures annulées${g[1] ? ` sur ${g[1]}` : ""} : ${g[2]}`],
    [/^Standards edition changed from (.+) to (.+): (.+)$/, (g) => `Édition des normes modifiée de ${g[1]} à ${g[2]} : ${g[3]}`],
    [/^Substantive analytical procedure saved on (.+)$/, (g) => `Procédure analytique de substance enregistrée sur ${g[1]}`],
    [/^Substantive-analytics thresholds set to (.+)$/, (g) => `Seuils des procédures analytiques de substance fixés à ${g[1]}`],
    [/^Template (\S+) reset to default$/, (g) => `Modèle ${g[1]} rétabli par défaut`],
    [/^Template (\S+) customized$/, (g) => `Modèle ${g[1]} personnalisé`],
    [/^Template assigned: (.+)$/, (g) => `Modèle affecté : ${g[1]}`],
    [/^Engagement accepted$/, () => "Mission acceptée"],
    [/^Engagement declined: (.+)$/, (g) => `Mission déclinée : ${g[1]}`],
    [/^(\S+) no longer marked not applicable$/, (g) => `${g[1]} n'est plus marquée sans objet`],
    [/^Partner sign-off delegated$/, () => "Signature de l'associé déléguée"],
    [/^Partner sign-off delegation (.+)$/, (g) => `Délégation de signature de l'associé : ${g[1]}`],
    [/^Allowed email domains set to (.+)$/, (g) => `Domaines de courriel autorisés : ${g[1]}`],
    [/^Allowed email domains cleared$/, () => "Domaines de courriel autorisés supprimés"],
    [/^Misstatement (.+)$/, (g) => `Anomalie : ${g[1]}`],
    [/^Refused: (.+)$/, (g) => `Refusé : ${g[1]}`],
    [/^Audit file archived and locked$/, () => "Dossier archivé et verrouillé"],
    // the client-request (PBC) trail (UAT run 2 B74)
    [/^PBC requested: (.+)$/, (g) => `Demande au client (PBC) émise : ${g[1]}`],
    [/^PBC chased: (.+)$/, (g) => `Demande au client (PBC) relancée : ${g[1]}`],
    [/^PBC uploaded by the client: (.+)$/, (g) => `Document déposé par le client (PBC) : ${g[1]}`],
    [/^PBC (accepted|filed): (.+)$/, (g) => `Demande au client (PBC) ${g[1] === "accepted" ? "acceptée" : "classée"} : ${g[2]}`],
  ];
  for (const [re, fr] of rules) {
    const hit = re.exec(summary);
    if (hit) return fr([...hit]);
  }
  return summary;
}

/**
 * Notification titles are stored as written, some in English alone; those are
 * shown in the reader's language (F086). A title already written in both
 * languages, or unknown, is shown as stored.
 */
export function localizedNotificationTitle(title: string, locale: string): string {
  if (locale !== "fr") return title;
  const rules: [RegExp, (g: string[]) => string][] = [
    [/^Sign-off voided: (.+)$/, (g) => `Signature annulée : ${g[1]}`],
    [/^(\S+) reopened after (\S+) closed$/, (g) => `${g[1]} rouverte après la clôture de la phase ${g[2]}`],
    [/^Review note on a document$/, () => "Note de revue sur un document"],
    [/^Review note on (\S+)$/, (g) => `Note de revue sur ${g[1]}`],
    [/^You were mentioned in a discussion$/, () => "Vous avez été mentionné(e) dans une discussion"],
    [/^New reply to your comment$/, () => "Nouvelle réponse à votre commentaire"],
    [/^Risk added during execution — approval required$/, () => "Risque ajouté en cours d'exécution — approbation requise"],
    [/^Section (\S+) assigned to you$/, (g) => `Section ${g[1]} qui vous est assignée`],
    [/^Materiality revised$/, () => "Seuil de signification révisé"],
    [/^Reminder — PBC: (.+)$/, (g) => `Relance — demande au client (PBC) : ${g[1]}`],
    [/^PBC uploaded: (.+)$/, (g) => `Document déposé (PBC) : ${g[1]}`],
    [/^PBC: (.+)$/, (g) => `Demande au client (PBC) : ${g[1]}`],
    [/^SCOT assigned: (.+)$/, (g) => `SCOT assignée : ${g[1]}`],
  ];
  for (const [re, fr] of rules) {
    const hit = re.exec(title);
    if (hit) return fr([...hit]);
  }
  return title;
}
