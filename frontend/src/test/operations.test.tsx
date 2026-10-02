import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  screen,
  waitFor,
  renderHook,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useTaskMove, Kanban } from "@/components/Kanban";
import { LeadForm, leadSchema } from "@/components/LeadForm";
import { IntegrationLogs } from "@/components/IntegrationLogs";
import { type Task } from "@/types";
import * as apiModule from "@/lib/api";
const task: Task = {
  id: "t1",
  lead: "l1",
  title: "Atender lead",
  customer_name: "Ana Silva",
  team: "Comercial",
  priority: "HIGH",
  status: "ASSIGNED",
  version: 2,
  due_at: "2030-01-01",
  channel: "email",
  assignee: "demo",
};
function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
function queryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}
describe("persistência do Kanban", () => {
  it("envia status e versão para a API", async () => {
    const client = queryClient();
    client.setQueryData(["tasks"], [task]);
    const api = vi
      .spyOn(apiModule, "api")
      .mockResolvedValue({ ...task, status: "IN_PROGRESS", version: 3 });
    const { result } = renderHook(() => useTaskMove(), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync({ task, status: "IN_PROGRESS" });
    });
    expect(api).toHaveBeenCalledWith("/tasks/t1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS", version: 2 }),
    });
  });
  it("reverte o cache quando a API falha", async () => {
    const client = queryClient();
    client.setQueryData(["tasks"], [task]);
    vi.spyOn(apiModule, "api").mockRejectedValue(new Error("Conflito"));
    const { result } = renderHook(() => useTaskMove(), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current
        .mutateAsync({ task, status: "RESOLVED" })
        .catch(() => {});
    });
    expect(client.getQueryData<Task[]>(["tasks"])?.[0].status).toBe("ASSIGNED");
  });
  it("impede movimentação para leitura", async () => {
    vi.spyOn(apiModule, "allPages").mockResolvedValue([task]);
    render(<Kanban canWrite={false} onOpen={() => {}} />, {
      wrapper: wrapper(queryClient()),
    });
    expect(
      await screen.findByRole("button", { name: "Mover Ana Silva" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: "Status de Ana Silva" }),
    ).toBeDisabled();
  });
  it("move pelo controle acessível e persiste", async () => {
    vi.spyOn(apiModule, "allPages").mockResolvedValue([task]);
    const api = vi
      .spyOn(apiModule, "api")
      .mockResolvedValue({ ...task, status: "IN_PROGRESS" });
    render(<Kanban canWrite onOpen={() => {}} />, {
      wrapper: wrapper(queryClient()),
    });
    await screen.findByRole("button", { name: "Mover Ana Silva" });
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Status de Ana Silva" }),
      "IN_PROGRESS",
    );
    await waitFor(() => expect(api).toHaveBeenCalled());
  });
});
describe("formulário", () => {
  it("valida conteúdo e email", () => {
    expect(
      leadSchema.safeParse({
        name: "Ana",
        email: "bad",
        phone: "",
        channel: "email",
        content: "x",
      }).success,
    ).toBe(false);
  });
  it("não chama API com campos inválidos", async () => {
    const api = vi
      .spyOn(apiModule, "api")
      .mockResolvedValue([{ slug: "website", name: "Website" }]);
    render(<LeadForm onClose={() => {}} />, {
      wrapper: wrapper(queryClient()),
    });
    await userEvent.click(screen.getByRole("button", { name: "Criar lead" }));
    expect(
      await screen.findByText("Informe pelo menos 2 caracteres"),
    ).toBeInTheDocument();
    expect(api.mock.calls.some((c) => c[0] === "/leads")).toBe(false);
  });
  it("envia solicitação válida", async () => {
    const api = vi
      .spyOn(apiModule, "api")
      .mockResolvedValue([{ slug: "website", name: "Website" }]);
    const close = vi.fn();
    render(<LeadForm onClose={close} />, { wrapper: wrapper(queryClient()) });
    await screen.findByRole("option", { name: "Website" });
    await userEvent.type(screen.getByLabelText("Nome do cliente"), "Ana Silva");
    await userEvent.type(
      screen.getByLabelText("Solicitação"),
      "Quero orçamento empresarial",
    );
    await userEvent.click(screen.getByRole("button", { name: "Criar lead" }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(
      api.mock.calls.some((c) => c[0] === "/leads" && c[1]?.method === "POST"),
    ).toBe(true);
  });
});
describe("logs e permissões", () => {
  const log = {
    id: "log1",
    lead: "l1",
    integration: "crm",
    status: "FAILED",
    attempt: 5,
    error: "CRM indisponível",
    payload: { email: "[REDACTED]" },
    created_at: "2026-10-01",
  };
  it("exibe erro e bloqueia ação sem permissão", async () => {
    vi.spyOn(apiModule, "api").mockResolvedValue({
      results: [log],
      count: 1,
      next: null,
    });
    render(<IntegrationLogs canWrite={false} />, {
      wrapper: wrapper(queryClient()),
    });
    expect(await screen.findByText("CRM indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reprocessar" })).toBeDisabled();
    expect(screen.getByText(/REDACTED/)).toBeInTheDocument();
  });
  it("reprocessa via API", async () => {
    const api = vi
      .spyOn(apiModule, "api")
      .mockResolvedValue({ results: [log], count: 1, next: null });
    render(<IntegrationLogs canWrite />, { wrapper: wrapper(queryClient()) });
    await userEvent.click(
      await screen.findByRole("button", { name: "Reprocessar" }),
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/integration-logs/log1/reprocess", {
        method: "POST",
      }),
    );
  });
});
