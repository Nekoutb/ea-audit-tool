/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
const url = "file:///C:/Users/UltraBook 3.1/Documents/AI Projects/lms/_transcript-review.html";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const base = await page.evaluate(() => ({
    courses: document.querySelectorAll("section.course").length,
    sheets: document.querySelectorAll(".sheet").length,
    segments: document.querySelectorAll(".seg").length,
    counter: document.getElementById("counter").textContent,
    repeated: [...document.querySelectorAll(".phrase-list > div")].slice(0, 6).map((d) => d.textContent.trim()),
    warn: document.querySelectorAll(".chip.warn").length,
    sample: document.querySelector(".seg-body p").textContent.slice(0, 80),
  }));
  console.log("STRUCTURE", JSON.stringify(base, null, 1));

  await page.fill("#q", "bribe");
  await page.waitForTimeout(350);
  console.log("SEARCH 'bribe' ->", await page.textContent("#counter"), "| marks:", await page.evaluate(() => document.querySelectorAll("mark").length));
  await page.fill("#q", "");
  await page.check("#longOnly");
  await page.waitForTimeout(350);
  console.log("LONG-ONLY ->", await page.textContent("#counter"));
  await page.uncheck("#longOnly");
  await page.waitForTimeout(250);

  for (const [w, h] of [[360, 740], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const over = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    console.log(`RESPONSIVE ${w}px -> hScroll=${over}`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(250);
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log("DARK bg:", dark);
  console.log("JS ERRORS:", errors.length ? errors.slice(0, 3) : "none");
  await browser.close();
})();
