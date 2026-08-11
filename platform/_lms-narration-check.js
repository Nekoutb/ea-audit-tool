/* eslint-disable @typescript-eslint/no-require-imports */
// Verifies the narration library matches the reviewed bilingual edition and
// that the voice is chosen by language with no narrator concept left anywhere.
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");

const LMS = "C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\lms";
const REVIEWED = process.env.REVIEWED_JSON
  ?? "C:\\Users\\ULTRAB~1.1\\AppData\\Local\\Temp\\claude\\C--Users-UltraBook-3-1-Documents-AI-Projects-EA-AUDIT-TOOL\\24900764-b035-4a30-8014-b3bf94f10ad3\\scratchpad\\mapping.json";

const EN_VOICE = "zGjIP4SZlMnY9m93k97r";
const FR_VOICE = "aQROLel5sQbj1vuIVi6B";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

const read = (rel) => readFileSync(path.join(LMS, rel), "utf8");

console.log("Narration library and voice configuration\n");

// --- the scripts -------------------------------------------------------------
const narration = read("app/narration-content.ts");
const lessonIds = [...narration.matchAll(/^  "([\w-]+)": \{$/gm)].map((m) => m[1]);
check("39 lessons are present", lessonIds.length === 39, `found ${lessonIds.length}`);
check("no lesson id is defined twice", new Set(lessonIds).size === lessonIds.length);

// Segment counts, read from the emitted arrays.
const blocks = narration.split(/^  "/m).slice(1);
let shortBlocks = 0, emptySegments = 0;
for (const block of blocks) {
  for (const lang of ["EN", "FR"]) {
    const arr = block.match(new RegExp(`${lang}: \\[([\\s\\S]*?)\\n    \\]`));
    const items = arr ? [...arr[1].matchAll(/^      "/gm)] : [];
    if (items.length !== 5) shortBlocks += 1;
    if (/""/.test(arr?.[1] ?? "")) emptySegments += 1;
  }
}
check("every lesson has five segments in each language", shortBlocks === 0, `${shortBlocks} irregular`);
check("no segment is empty", emptySegments === 0);

// --- fidelity to the reviewed document ---------------------------------------
if (existsSync(REVIEWED)) {
  const reviewed = JSON.parse(readFileSync(REVIEWED, "utf8"));
  let missing = 0, checked = 0;
  for (const [lessonId, lesson] of Object.entries(reviewed)) {
    for (const lang of ["EN", "FR"]) {
      for (const segment of lesson[lang]) {
        checked += 1;
        // The emitted file escapes double quotes; compare on the escaped form.
        if (!narration.includes(segment.replace(/\\/g, "\\\\").replace(/"/g, '\\"'))) missing += 1;
      }
    }
  }
  check(`all ${checked} reviewed segments appear verbatim`, missing === 0, `${missing} missing`);
} else {
  console.log("  SKIP  reviewed source not available for a verbatim comparison");
}

// --- voices ------------------------------------------------------------------
const voiceConfig = read("app/voice-config.ts");
check("English voice id is the reviewed one", voiceConfig.includes(EN_VOICE));
check("French voice id is the reviewed one", voiceConfig.includes(FR_VOICE));
check("the previous voice id is gone", !voiceConfig.includes("EXAVITQu4vr4xnSDxMaL"));

const route = read("app/api/narration/route.ts");
check("the narration route picks the voice by language", route.includes("voiceIdForLanguage(language"));
check("the route no longer accepts a voice parameter", !route.includes('"voice"'));

const player = read("app/course-player.tsx");
check("the player sends no voice parameter", !player.includes("&voice="));
check("no narrator name is shown to learners", !/narrator\.(name|role|direction)/.test(player));

const page = read("app/page.tsx");
check("the learner has no voice picker", !page.includes("prefNarrator"));
check("no voice names remain in the preferences", !/voiceEnFemale|voiceEnMale|voiceFrFemale/.test(page));

for (const file of ["app/narration-audio.ts", "app/voice-config.ts", "scripts/generate-narration-library.mjs"]) {
  check(`${file} carries no narrator identity`, !/amara|NarratorId/.test(read(file)));
}

// --- served from the server, not generated per request -----------------------
const compose = read("compose.yaml");
check("the narration library has its own persistent volume", compose.includes("ea-learnings-narration:/app/dist/client/narration/generated:ro"));
check("the volume is declared", /^ {2}ea-learnings-narration:/m.test(compose));

const audio = read("app/narration-audio.ts");
check("pre-generated audio is served", audio.includes("HOSTED_NARRATION_AVAILABLE = true"));
check("audio paths carry the voice", audio.includes("voiceSlugForLanguage(language)"));

const generator = read("scripts/generate-narration-library.mjs");
check("the generator can write to the server volume", generator.includes("NARRATION_OUTPUT_DIR"));
check("the manifest follows the library version", generator.includes('HOSTED_NARRATION_VERSION, "manifest.json"'));

check("generated audio is not committed", read(".gitignore").includes("public/narration/generated/"));
check(
  "the stale library is gone",
  !existsSync(path.join(LMS, "public/narration/generated/v1")) && !existsSync(path.join(LMS, "public/narration/generated/v2")),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
