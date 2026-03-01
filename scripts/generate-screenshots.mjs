/**
 * Generates all README screenshot images using Playwright.
 *
 * Usage:
 *   1. Start the dev server: npm start
 *   2. Run this script:      node scripts/generate-screenshots.mjs
 *
 * Produces the following files in images/:
 *   header_dark.png, header_light.png
 *   body_dark.png, body_light.png
 *   results_dark.png, results_light.png
 *   views_dark.png, views_light.png
 *   validator_1_1A.png, validator_solna_students.png
 */

import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, "..", "images");
const BASE_URL = "http://localhost:3000";

const QUERY_1A =
  "SELECT personnummer, namn, adress, postnr FROM person WHERE ort = 'Solna'";
const VIEW_SQL =
  "CREATE VIEW solna_students AS SELECT * FROM Person JOIN Student USING (Personnummer) WHERE ort = 'Solna'";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem("theme", t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, theme);
  await page.waitForTimeout(400);
}

async function selectQuestion(page, category, sequence) {
  const triggers = page.locator('button[role="combobox"]');
  await triggers.first().click();
  await page
    .locator("[role=\"option\"]")
    .filter({ hasText: new RegExp(`^\\s*${category}\\s*$`) })
    .first()
    .click();
  await page.waitForTimeout(300);

  await triggers.nth(1).click();
  await page
    .locator("[role=\"option\"]")
    .filter({ hasText: new RegExp(`^\\s*${sequence}\\s*$`) })
    .first()
    .click();
  await page.waitForTimeout(300);
}

async function setEditorContent(page, content) {
  const textarea = page.locator("#editor textarea");
  await textarea.click();
  await page.keyboard.press("Control+a");
  await textarea.fill(content);
  await page.waitForTimeout(200);
}

/**
 * Get bounding box of a locator in page-level coordinates (not viewport-relative).
 */
async function pageBox(page, locator) {
  const handle = await locator.elementHandle();
  if (!handle) return null;
  return page.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + window.scrollX,
      y: r.top + window.scrollY,
      width: r.width,
      height: r.height,
    };
  }, handle);
}

/**
 * Takes a screenshot of a page region defined by two locators (top and bottom).
 * Scrolls so the region is visible and uses viewport-clip.
 */
async function clipRegion(page, topLocator, bottomLocator, filePath, { padTop = 5, padBottom = 5 } = {}) {
  // Get page-level positions
  const topRect = await pageBox(page, topLocator);
  const bottomRect = await pageBox(page, bottomLocator);
  if (!topRect || !bottomRect) throw new Error(`Elements not found for ${filePath}`);

  const vp = page.viewportSize();
  const regionTop = topRect.y - padTop;
  const regionBottom = bottomRect.y + bottomRect.height + padBottom;
  const regionHeight = regionBottom - regionTop;

  // Scroll so the region starts at the top of the viewport
  await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, regionTop));
  await page.waitForTimeout(200);

  const scrollY = await page.evaluate(() => window.scrollY);

  // Calculate viewport-relative clip
  const clipY = regionTop - scrollY;
  const clip = {
    x: 0,
    y: Math.max(0, clipY),
    width: vp.width,
    height: Math.min(regionHeight, vp.height - Math.max(0, clipY)),
  };

  if (clip.height <= 0) throw new Error(`Invalid clip height for ${filePath}: ${JSON.stringify(clip)}`);

  await page.screenshot({ path: filePath, clip, timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 960, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${BASE_URL}...`);
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("h1");
    console.log("App loaded.");

    // Step 1: Select question 1A
    console.log("Selecting question 1A...");
    await selectQuestion(page, "1", "A");
    await page.waitForTimeout(500);

    // Step 2: Create the solna_students view
    console.log("Creating solna_students view...");
    await setEditorContent(page, VIEW_SQL);
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Run Query")').click();
    await page.waitForTimeout(1000);

    // Step 3: Run the correct query for 1A so it gets marked as correct (green)
    console.log("Setting up query 1A...");
    await setEditorContent(page, QUERY_1A);
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Run Query")').click();
    await page.waitForTimeout(1000);

    // Re-select to clear results for body screenshot, keeping green highlight
    await selectQuestion(page, "2", "A");
    await page.waitForTimeout(300);
    await selectQuestion(page, "1", "A");
    await page.waitForTimeout(500);

    // Format the code
    await page.locator('button:has-text("Format Code")').click();
    await page.waitForTimeout(500);

    // Ensure views section is showing
    const viewsBtn = page.locator("button").filter({ hasText: /Views/ }).first();
    const viewNameLink = page.locator("button.text-left", { hasText: "solna_students" });
    if (!(await viewNameLink.isVisible())) {
      await viewsBtn.click();
      await page.waitForTimeout(300);
    }

    // -----------------------------------------------------------------------
    // HEADER + BODY screenshots (no results showing)
    // -----------------------------------------------------------------------
    console.log("Taking header & body screenshots...");

    const themeToggle = page.locator(".App-header > div").first();
    const dbLayout = page.locator('button[aria-label="Open Database Layout"]');
    const questionRow = page.locator("text=Question").locator("..").locator("..").first();
    const viewsSection = page.locator(".App-header > div.w-full.max-w-4xl").last();

    for (const theme of ["dark", "light"]) {
      await setTheme(page, theme);

      await clipRegion(page, themeToggle, dbLayout,
        path.join(IMAGES_DIR, `header_${theme}.png`), { padTop: 0, padBottom: 10 });
      console.log(`  ✓ header_${theme}.png`);

      await clipRegion(page, questionRow, viewsSection,
        path.join(IMAGES_DIR, `body_${theme}.png`), { padTop: 0, padBottom: 10 });
      console.log(`  ✓ body_${theme}.png`);
    }

    // -----------------------------------------------------------------------
    // Run query → RESULTS screenshots
    // -----------------------------------------------------------------------
    console.log("Running query for results...");
    await page.locator("#editor").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.locator('button:has-text("Run Query")').click();
    await page.waitForTimeout(1000);

    // "Matching Result!" parent div
    const matchBanner = page.locator("text=Matching Result!").locator("..").first();
    // The result tables container - use the one with gap-4 to distinguish from QuestionSelector
    const tablesWrap = page.locator(".flex.flex-wrap.max-w-full.justify-center").first();

    for (const theme of ["dark", "light"]) {
      await setTheme(page, theme);
      await clipRegion(page, matchBanner, tablesWrap,
        path.join(IMAGES_DIR, `results_${theme}.png`));
      console.log(`  ✓ results_${theme}.png`);
    }

    // -----------------------------------------------------------------------
    // Expand view → VIEWS screenshots
    // -----------------------------------------------------------------------
    console.log("Expanding solna_students view...");
    await viewNameLink.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await viewNameLink.click();
    await page.waitForTimeout(1000);

    const viewHeading = page.locator("h2", { hasText: "View solna_students" });
    const viewsSectionBottom = page.locator(".App-header > div.w-full.max-w-4xl").last();

    for (const theme of ["dark", "light"]) {
      await setTheme(page, theme);
      await clipRegion(page, viewHeading, viewsSectionBottom,
        path.join(IMAGES_DIR, `views_${theme}.png`));
      console.log(`  ✓ views_${theme}.png`);
    }

    // -----------------------------------------------------------------------
    // Export validator_1_1A.png
    // -----------------------------------------------------------------------
    console.log("Exporting validator_1_1A.png...");
    await selectQuestion(page, "1", "A");
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Run Query")').click();
    await page.waitForTimeout(1000);

    const [download1] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      (async () => {
        await page.locator('button[aria-label="Actions menu"]').click();
        await page.waitForTimeout(200);
        await page.locator('[role="menuitem"]', { hasText: "Export PNG" }).click();
      })(),
    ]);
    await download1.saveAs(path.join(IMAGES_DIR, "validator_1_1A.png"));
    console.log("  ✓ validator_1_1A.png");
    await page.waitForTimeout(500);

    // -----------------------------------------------------------------------
    // Export validator_solna_students.png
    // -----------------------------------------------------------------------
    console.log("Exporting validator_solna_students.png...");
    if (!(await viewNameLink.isVisible())) {
      await viewsBtn.click();
      await page.waitForTimeout(300);
    }

    const [download2] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.locator("button", { hasText: "Export PNG" })
        .filter({ has: page.locator("svg") })
        .first()
        .click(),
    ]);
    await download2.saveAs(path.join(IMAGES_DIR, "validator_solna_students.png"));
    console.log("  ✓ validator_solna_students.png");

    console.log("\nAll screenshots generated successfully!");
  } catch (err) {
    console.error("Error:", err.message);
    await page.screenshot({ path: path.join(IMAGES_DIR, "_debug.png"), fullPage: true });
    console.error("Debug screenshot saved to images/_debug.png");
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
