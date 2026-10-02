import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.PREVIEW_URL || "http://127.0.0.1:5188", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.DEMO_PASSWORD || "local-demo-only");
  await page.getByRole("button", { name: "Entrar na central" }).click();
  await page.getByText("PULSO DA OPERAÇÃO").waitFor();
  await page
    .getByRole("img", { name: "Gráfico de leads recebidos por dia" })
    .waitFor();
  await page.waitForTimeout(1500);
  await mkdir("../docs/evidence", { recursive: true });
  await page.screenshot({
    path: "../docs/evidence/dashboard.png",
    fullPage: true,
  });
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Kanban de tarefas" })
    .click();
  await page.locator(".task-card").first().waitFor();
  await page.locator(".kanban-board").evaluate((el) => (el.scrollLeft = 540));
  await page.screenshot({
    path: "../docs/evidence/kanban.png",
    fullPage: true,
  });
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Logs de integração" })
    .click();
  await page.getByRole("button", { name: "Reprocessar" }).first().waitFor();
  await page.getByText("Payload mascarado").first().click();
  await page.screenshot({ path: "../docs/evidence/logs.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Leads", exact: true })
    .click();
  await page.locator(".customer-cell").first().click();
  await page.getByText("Detalhes do lead", { exact: true }).waitFor();
  await page.locator('.lead-profile h2').waitFor();
  await page.locator('.recommendation').first().waitFor();
  await page.screenshot({
    path: "../docs/evidence/mobile-lead.png",
    fullPage: false,
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Four screenshots captured against the real local Django API; no browser errors.",
  );
} catch(error) {
  console.error('Browser errors:', errors);
  console.error('Visible page:', await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
