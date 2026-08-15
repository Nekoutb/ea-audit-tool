// FS tie-out (steps 7.4/7.5, spec §10.4): recompute the Compte de résultat SIG
// cascade line-by-line per Appendix B.3 and the Bilan's key aggregates from the
// engagement's current TB, then verify internal equilibrium (TB balanced;
// total actif = capitaux propres + dettes; bilan result = CR result).
// Optionally diff against a client-provided FS (CSV: ref;amount).
// TFT recomputation is explicitly out of scope per the spec's note (the
// official correspondence is not included — Bilan + CR are the v1 core).

import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

interface Closings {
  get(prefixes: string[], exclude?: string[]): number;
}

async function loadClosings(tx: PoolClient, engagementId: string): Promise<{ closings: Closings; rowCount: number }> {
  const result = await tx.query<{ account_code: string; closing: string }>(
    `SELECT r.account_code,
            sum(r.opening_debit - r.opening_credit + r.debit - r.credit)::text AS closing
       FROM trial_balance tb
       JOIN trial_balance_version v ON v.trial_balance_id = tb.id AND v.version_no = tb.current_version_no
       JOIN trial_balance_row r ON r.version_id = v.id
      WHERE tb.engagement_id = $1
      GROUP BY r.account_code`,
    [engagementId],
  );
  const rows = result.rows.map((row) => ({ account: row.account_code, closing: Number(row.closing) }));
  return {
    rowCount: rows.length,
    closings: {
      get(prefixes: string[], exclude: string[] = []): number {
        let total = 0;
        for (const row of rows) {
          if (exclude.some((prefix) => row.account.startsWith(prefix))) continue;
          if (prefixes.some((prefix) => row.account.startsWith(prefix))) total += row.closing;
        }
        return total;
      },
    },
  };
}

export interface FsLine {
  ref: string;
  label: string;
  amount: number;
}

/**
 * Compte de résultat — Appendix B.3, full SIG cascade. TB closings carry
 * natural signs (charges debit-positive, produits credit-negative), so income
 * lines are negated to read positively and charge lines subtract.
 */
export function computeCr(c: Closings): { lines: FsLine[]; result: number } {
  const income = (prefixes: string[], exclude?: string[]): number => -c.get(prefixes, exclude);
  const charge = (prefixes: string[], exclude?: string[]): number => c.get(prefixes, exclude);

  const TA = income(["701"]);
  const RA = charge(["601"]);
  const RB = charge(["6031"]);
  const XA = TA - RA - RB;
  const TB_ = income(["702", "703", "704"]);
  const TC = income(["705", "706"]);
  const TD = income(["707"]);
  const XB = TA + TB_ + TC + TD;
  const TE = income(["73"]);
  const TF = income(["72"]);
  const TG = income(["71"]);
  const TH = income(["75"]);
  const TI = income(["781"]);
  const RC = charge(["602"]);
  const RD = charge(["6032"]);
  const RE = charge(["604", "605", "608"]);
  const RF = charge(["6033"]);
  const RG = charge(["61"]);
  const RH = charge(["62", "63"]);
  const RI = charge(["64"]);
  const RJ = charge(["65"]);
  const XC = XA + TB_ + TC + TD + TE + TF + TG + TH + TI - RC - RD - RE - RF - RG - RH - RI - RJ;
  const RK = charge(["66"]);
  const XD = XC - RK;
  const TJ = income(["791", "798", "799"]);
  const RL = charge(["681", "691"]);
  const XE = XD + TJ - RL;
  const TK = income(["77"]);
  const TL = income(["797"]);
  const TM = income(["787"]);
  const RM = charge(["67"]);
  const RN = charge(["697"]);
  const XF = TK + TL + TM - RM - RN;
  const XG = XE + XF;
  const TN = income(["82"]);
  const TO = income(["84", "86", "88"]);
  const RO = charge(["81"]);
  const RP = charge(["83", "85"]);
  const XH = TN + TO - RO - RP;
  const RQ = charge(["87"]);
  const RS = charge(["89"]);
  const XI = XG + XH - RQ - RS;

  const lines: FsLine[] = [
    { ref: "TA", label: "Ventes de marchandises", amount: TA },
    { ref: "RA", label: "Achats de marchandises", amount: -RA },
    { ref: "RB", label: "Variation stocks marchandises", amount: -RB },
    { ref: "XA", label: "MARGE COMMERCIALE", amount: XA },
    { ref: "TB", label: "Ventes de produits fabriqués", amount: TB_ },
    { ref: "TC", label: "Travaux, services vendus", amount: TC },
    { ref: "TD", label: "Produits accessoires", amount: TD },
    { ref: "XB", label: "CHIFFRE D'AFFAIRES", amount: XB },
    { ref: "TE", label: "Production stockée", amount: TE },
    { ref: "TF", label: "Production immobilisée", amount: TF },
    { ref: "TG", label: "Subventions d'exploitation", amount: TG },
    { ref: "TH", label: "Autres produits", amount: TH },
    { ref: "TI", label: "Transferts de charges d'exploitation", amount: TI },
    { ref: "RC", label: "Achats de MP", amount: -RC },
    { ref: "RD", label: "Variation stocks MP", amount: -RD },
    { ref: "RE", label: "Autres achats", amount: -RE },
    { ref: "RF", label: "Variation stocks autres appro.", amount: -RF },
    { ref: "RG", label: "Transports", amount: -RG },
    { ref: "RH", label: "Services extérieurs", amount: -RH },
    { ref: "RI", label: "Impôts et taxes", amount: -RI },
    { ref: "RJ", label: "Autres charges", amount: -RJ },
    { ref: "XC", label: "VALEUR AJOUTÉE", amount: XC },
    { ref: "RK", label: "Charges de personnel", amount: -RK },
    { ref: "XD", label: "EXCÉDENT BRUT D'EXPLOITATION", amount: XD },
    { ref: "TJ", label: "Reprises d'exploitation", amount: TJ },
    { ref: "RL", label: "Dotations d'exploitation", amount: -RL },
    { ref: "XE", label: "RÉSULTAT D'EXPLOITATION", amount: XE },
    { ref: "TK", label: "Revenus financiers", amount: TK },
    { ref: "TL", label: "Reprises financières", amount: TL },
    { ref: "TM", label: "Transferts de charges financières", amount: TM },
    { ref: "RM", label: "Frais financiers", amount: -RM },
    { ref: "RN", label: "Dotations financières", amount: -RN },
    { ref: "XF", label: "RÉSULTAT FINANCIER", amount: XF },
    { ref: "XG", label: "RÉSULTAT DES ACTIVITÉS ORDINAIRES", amount: XG },
    { ref: "TN", label: "Produits des cessions", amount: TN },
    { ref: "TO", label: "Autres produits HAO", amount: TO },
    { ref: "RO", label: "Valeurs comptables des cessions", amount: -RO },
    { ref: "RP", label: "Autres charges HAO", amount: -RP },
    { ref: "XH", label: "RÉSULTAT HAO", amount: XH },
    { ref: "RQ", label: "Participation des travailleurs", amount: -RQ },
    { ref: "RS", label: "Impôts sur le résultat", amount: -RS },
    { ref: "XI", label: "RÉSULTAT NET", amount: XI },
  ];
  return { lines, result: XI };
}

/** Bilan key aggregates + equilibrium checks (7.4 core). */
export function computeBilan(c: Closings, crResult: number): {
  lines: FsLine[];
  checks: { key: string; ok: boolean; amount: number }[];
} {
  const immobilisations = c.get(["21", "22", "23", "24", "25", "28", "29"]);
  const financier = c.get(["26", "27", "296", "297"]);
  const stocks = c.get(["31", "32", "33", "34", "35", "36", "37", "38", "39"]);
  const tiersNet = c.get(["40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "185"]);
  const tresorerieNette = c.get(["50", "51", "52", "53", "54", "55", "56", "57", "58", "59"]);
  const ecartActif = c.get(["478"]);
  const ecartPassif = c.get(["479"]);
  const capitauxPropres = -c.get(["10", "11", "12", "13", "14", "15"]);
  const dettesFinancieres = -c.get(["16", "17", "18"]);
  const provisions = -c.get(["19"]);

  const class15 = c.get(["1", "2", "3", "4", "5"]);
  const class68 = c.get(["6", "7", "8"]);

  const lines: FsLine[] = [
    { ref: "AZ~", label: "Actif immobilisé net (2x incl. 28/29)", amount: immobilisations + financier },
    { ref: "BB", label: "Stocks et encours nets (3x)", amount: stocks },
    { ref: "B~", label: "Tiers nets (4x — sign-split at FS presentation)", amount: tiersNet - ecartActif },
    { ref: "BT~", label: "Trésorerie nette (5x)", amount: tresorerieNette },
    { ref: "BU", label: "Écart de conversion — Actif (478)", amount: ecartActif },
    { ref: "CP", label: "Capitaux propres (10–15, hors résultat)", amount: capitauxPropres },
    { ref: "CJ", label: "Résultat net de l'exercice (du CR)", amount: crResult },
    { ref: "DF~", label: "Dettes financières (16–18)", amount: dettesFinancieres },
    { ref: "DC", label: "Provisions pour risques et charges (19)", amount: provisions },
    { ref: "DV", label: "Écart de conversion — Passif (479)", amount: -ecartPassif },
  ];

  const checks = [
    // A balanced TB: classes 1–8 closings sum to zero.
    { key: "tb_balanced", ok: Math.abs(class15 + class68) < 1, amount: class15 + class68 },
    // Bilan equilibrium: net assets of classes 1–5 equal the CR result
    // (P&L not yet closed to 13x), i.e. class15 = résultat.
    { key: "bilan_equilibrium", ok: Math.abs(class15 - crResult) < 1, amount: class15 - crResult },
  ];
  return { lines, checks };
}

export interface TieoutResult {
  cr: FsLine[];
  bilan: FsLine[];
  checks: { key: string; ok: boolean; amount: number }[];
  clientDiffs: { ref: string; recomputed: number; client: number; difference: number }[];
  pass: boolean;
}

/**
 * Run the tie-out. `clientFs` is an optional CSV (ref;amount) of the client's
 * draft FS — recomputed lines are diffed against it; differences above the
 * trivial threshold are exceptions (spec §10.4 → C2.1).
 */
export async function runFsTieout(
  engagementId: string,
  clientFs?: Buffer,
): Promise<TieoutResult> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const { closings, rowCount } = await loadClosings(tx, engagementId);
    if (rowCount === 0) throw new Error("no-tb");

    const cr = computeCr(closings);
    const bilan = computeBilan(closings, cr.result);

    const trivial = await tx.query<{ trivial: string }>(
      `SELECT trivial::text FROM materiality
        WHERE engagement_id = $1 AND status = 'approved'
        ORDER BY version_no DESC LIMIT 1`,
      [engagementId],
    );
    const threshold = trivial.rows[0] ? Number(trivial.rows[0].trivial) : 0;

    const clientDiffs: TieoutResult["clientDiffs"] = [];
    if (clientFs) {
      const clientLines = new Map<string, number>();
      for (const line of clientFs.toString("utf8").split(/\r?\n/)) {
        const [ref, amount] = line.split(";").map((cell) => cell.trim());
        if (ref && amount && !Number.isNaN(Number(amount))) clientLines.set(ref.toUpperCase(), Number(amount));
      }
      const recomputed = new Map([...cr.lines, ...bilan.lines].map((line) => [line.ref, line.amount]));
      for (const [ref, clientAmount] of clientLines) {
        const ours = recomputed.get(ref);
        if (ours === undefined) continue;
        const difference = Math.round(ours - clientAmount);
        if (Math.abs(difference) > threshold) {
          clientDiffs.push({ ref, recomputed: Math.round(ours), client: clientAmount, difference });
        }
      }
    }

    return {
      cr: cr.lines,
      bilan: bilan.lines,
      checks: bilan.checks,
      clientDiffs,
      pass: bilan.checks.every((check) => check.ok) && clientDiffs.length === 0,
    };
  });
}
