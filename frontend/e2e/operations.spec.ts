import { test, expect, type Page } from "@playwright/test";
const original = {
  id: "task-1",
  lead: "lead-1",
  title: "Atender plano empresarial",
  customer_name: "Ana Silva",
  channel: "email",
  team: "Comercial",
  priority: "HIGH",
  status: "ASSIGNED",
  version: 0,
  due_at: "2030-10-01T12:00:00Z",
  assignee: "demo",
};
async function setup(page: Page, { canWrite = true, failMove = false } = {}) {
  let task = { ...original };
  const requests: { path: string; method: string; body: unknown }[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api", "");
    requests.push({
      path,
      method: request.method(),
      body: request.postDataJSON(),
    });
    let data: unknown = {};
    let status = 200;
    if (path === "/me")
      data = { username: "demo", canWrite, isAdmin: canWrite };
    else if (path === "/channels")
      data = [
        { slug: "website", name: "Website" },
        { slug: "email", name: "E-mail" },
      ];
    else if (path === "/dashboard/metrics")
      data = {
        totalLeads: 12,
        openTasks: 9,
        resolvedTasks: 3,
        slaBreached: 2,
        slaCompliance: 77.8,
        integrationFailures: 4,
        automations: 2,
        channels: [
          { channel__name: "WhatsApp", count: 4 },
          { channel__name: "E-mail", count: 4 },
          { channel__name: "Website", count: 2 },
          { channel__name: "API", count: 2 },
        ],
        statuses: [],
        daily: [
          { day: "2026-09-27", count: 2 },
          { day: "2026-09-28", count: 3 },
          { day: "2026-09-29", count: 2 },
          { day: "2026-09-30", count: 4 },
          { day: "2026-10-01", count: 1 },
        ],
      };
    else if (path === "/tasks")
      data = { count: 1, next: null, results: [task] };
    else if (path === "/tasks/task-1/status") {
      if (failMove) {
        status = 409;
        data = { detail: "Conflito de versão" };
      } else {
        task = {
          ...task,
          ...request.postDataJSON(),
          version: task.version + 1,
        };
        data = task;
      }
    } else if (path === "/integration-logs")
      data = {
        count: 1,
        next: null,
        results: [
          {
            id: "log-1",
            lead: "lead-1",
            integration: "crm",
            status: "FAILED",
            attempt: 5,
            error: "CRM indisponível; limite de tentativas atingido",
            payload: { email: "[REDACTED]", leadId: "lead-1" },
            created_at: "2026-10-01T10:00:00Z",
          },
        ],
      };
    else if (path === "/integration-logs/log-1/reprocess") {
      status = 202;
      data = { status: "QUEUED" };
    } else if (path === "/leads" && request.method() === "POST") {
      status = 201;
      data = { id: "lead-2" };
    } else if (path === "/leads")
      data = {
        count: 1,
        next: null,
        results: [
          {
            id: "lead-1",
            customer: { name: "Ana Silva", email: "ana@example.com" },
            channel: "email",
            status: "ASSIGNED",
            category: "sales",
            priority: "HIGH",
            created_at: "2026-10-01",
          },
        ],
      };
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Senha", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Entrar na central" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", level: 1, exact: true }),
  ).toBeVisible();
  return requests;
}
async function dragTask(page: Page) {
  const handle = page.getByRole("button", { name: "Mover Ana Silva" });
  const target = page.locator(".kanban-column").filter({
    has: page.getByRole("heading", { name: "Em andamento", exact: true }),
  });
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Missing drag target");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 12,
    from.y + from.height / 2,
    { steps: 3 },
  );
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 20 });
  await page.mouse.up();
}
test("DnD persiste status na API", async ({ page }) => {
  const requests = await setup(page);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Kanban de tarefas" })
    .click();
  await page.locator(".kanban-board").evaluate((el) => {
    el.scrollLeft = 350;
  });
  await dragTask(page);
  await expect(
    page
      .locator(".kanban-column")
      .filter({
        has: page.getByRole("heading", { name: "Em andamento", exact: true }),
      })
      .getByText("Ana Silva"),
  ).toBeVisible();
  expect(
    requests.some(
      (r) =>
        r.path === "/tasks/task-1/status" &&
        r.method === "PATCH" &&
        (r.body as { status: string }).status === "IN_PROGRESS",
    ),
  ).toBeTruthy();
});
test("DnD com falha reverte e mostra feedback", async ({ page }) => {
  await setup(page, { failMove: true });
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Kanban de tarefas" })
    .click();
  await page.locator(".kanban-board").evaluate((el) => {
    el.scrollLeft = 350;
  });
  await dragTask(page);
  await expect(
    page.getByText("Movimentação revertida: Conflito de versão"),
  ).toBeVisible();
  await expect(
    page
      .locator(".kanban-column")
      .filter({
        has: page.getByRole("heading", { name: "Na fila", exact: true }),
      })
      .getByText("Ana Silva"),
  ).toBeVisible();
});
test("formulário valida e cria lead", async ({ page }) => {
  const requests = await setup(page);
  await page.getByRole("button", { name: "Novo lead" }).click();
  await page.getByRole("button", { name: "Criar lead" }).click();
  await expect(page.getByText("Informe pelo menos 2 caracteres")).toBeVisible();
  await page.getByLabel("Nome do cliente").fill("Ana Silva");
  await page.getByLabel("Solicitação").fill("Quero orçamento empresarial");
  await page.getByRole("button", { name: "Criar lead" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(
    requests.some((r) => r.path === "/leads" && r.method === "POST"),
  ).toBeTruthy();
});
test("logs mostram dados mascarados e agendam retry", async ({ page }) => {
  const requests = await setup(page);
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Logs de integração" })
    .click();
  await page.getByText("Payload mascarado").click();
  await expect(page.getByText(/REDACTED/)).toBeVisible();
  await page.getByRole("button", { name: "Reprocessar" }).click();
  await expect(page.getByText("Reprocessamento agendado")).toBeVisible();
  expect(
    requests.some(
      (r) =>
        r.path === "/integration-logs/log-1/reprocess" && r.method === "POST",
    ),
  ).toBeTruthy();
});
test("leitor não cria leads nem altera filas", async ({ page }) => {
  await setup(page, { canWrite: false });
  await expect(page.getByRole("button", { name: "Novo lead" })).toBeDisabled();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Kanban de tarefas" })
    .click();
  await expect(
    page.getByRole("button", { name: "Mover Ana Silva" }),
  ).toBeDisabled();
});
