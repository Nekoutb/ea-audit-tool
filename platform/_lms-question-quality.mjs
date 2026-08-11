/* Guards the assessment against the defects found on 2026-08-09:
 *   - one warning-sign set reused across twelve lessons
 *   - a templated French question stem, ungrammatical and unreadable
 *   - two filler answers padding every lesson's five choices
 * Run from the lms checkout with:
 *   node --experimental-strip-types _lms-question-quality.mjs                */
import path from "node:path";

const LMS = path.join("C:", "Users", "UltraBook 3.1", "Documents", "AI Projects", "lms");

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

// The pool that used to fill every question. Nothing should reach it now.
const FILLER = [
  "Continue while waiting for informal confirmation.",
  "Ask the external party to approve its own exception.",
  "Rely on a verbal assurance and keep no record.",
  "Postpone the concern until the transaction is complete.",
  "Continuer en attendant une confirmation informelle.",
  "Demander à la partie externe d’approuver sa propre exception.",
  "Se fier à une assurance verbale sans conserver de trace.",
];

(async () => {
  const { courseCatalog } = await import(`file://${path.join(LMS, "app", "course-data.ts").replace(/\\/g, "/")}`);
  const { getProductionLesson } = await import(`file://${path.join(LMS, "app", "production-content.ts").replace(/\\/g, "/")}`);

  console.log("Assessment question quality\n");

  for (const language of ["EN", "FR"]) {
    const red = new Map(), chk = new Map(), dec = new Map();
    const fillerHits = [];
    const templated = [];
    const duplicatesInOneQuestion = [];

    for (const course of courseCatalog) {
      for (const lesson of course.lessons) {
        const content = getProductionLesson(lesson.id, language);
        const tally = (map, options) => options.forEach((o) => map.set(o, (map.get(o) ?? 0) + 1));
        tally(red, content.redFlagActivity.options);
        tally(chk, content.check.options);
        tally(dec, content.decisionActivity.options);

        for (const options of [content.redFlagActivity.options, content.check.options, content.decisionActivity.options]) {
          for (const option of options) if (FILLER.includes(option)) fillerHits.push(`${lesson.id}: ${option.slice(0, 40)}`);
          if (new Set(options).size !== options.length) duplicatesInOneQuestion.push(lesson.id);
        }
        if (/does not follow the approved process|ne suit pas la procédure approuvée/.test(content.check.question)) {
          templated.push(lesson.id);
        }
      }
    }

    const worst = (map) => Math.max(...map.values());
    console.log(`  --- ${language} ---`);
    check(`${language}: no shared filler answer is used`, fillerHits.length === 0, fillerHits.slice(0, 3).join(" | "));
    check(`${language}: no templated question stem survives`, templated.length === 0, templated.join(", "));
    check(`${language}: no question repeats an option within itself`, duplicatesInOneQuestion.length === 0, duplicatesInOneQuestion.join(", "));
    check(`${language}: every warning-sign statement is lesson-specific`, worst(red) === 1, `worst repeat ${worst(red)}`);
    check(`${language}: every check answer is lesson-specific`, worst(chk) === 1, `worst repeat ${worst(chk)}`);
    // Decision answers are drawn from neighbouring lessons' real responses, so a
    // sentence appears once as its own correct answer and a few times as a
    // distractor elsewhere. What must not return is a filler used by all 39.
    check(`${language}: no decision answer is used by more than a few lessons`, worst(dec) <= 6, `worst repeat ${worst(dec)}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
