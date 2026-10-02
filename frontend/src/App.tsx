import { useState, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Columns3,
  ScrollText,
  Workflow,
  Plus,
  LogOut,
  ChevronRight,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { api, setCredentials, clearCredentials } from "./lib/api";
import { type User } from "./types";
import { Button } from "./components/ui/button";
const Dashboard = lazy(() =>
  import("./components/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Kanban = lazy(() =>
  import("./components/Kanban").then((m) => ({ default: m.Kanban })),
);
const LeadTable = lazy(() =>
  import("./components/LeadTable").then((m) => ({ default: m.LeadTable })),
);
import { LeadForm } from "./components/LeadForm";
const IntegrationLogs = lazy(() =>
  import("./components/IntegrationLogs").then((m) => ({
    default: m.IntegrationLogs,
  })),
);
import { LeadDrawer } from "./components/LeadDrawer";
import { ActionTabs } from "./components/microkit/ActionTabs";
const nav = [
  { id: "dashboard", name: "Visão geral", icon: LayoutDashboard },
  { id: "leads", name: "Leads", icon: Users },
  { id: "kanban", name: "Kanban de tarefas", icon: Columns3 },
  { id: "logs", name: "Logs de integração", icon: ScrollText },
];
function Login({ onLogin }: { onLogin: () => void }) {
  const [name, setName] = useState("demo"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <main className="login-page">
      <section className="login-brand">
        <span className="brand-icon">
          <Workflow size={27} />
        </span>
        <h1>
          automation<span>center</span>
        </h1>
        <h2>
          Cada entrada.
          <br />
          Um próximo passo.
        </h2>
        <p>
          Um espaço de trabalho para quem mantém a operação em movimento.
        </p>
        <div className="login-pipeline">
          <span>01 · Centralize</span>
          <span>02 · Automatize</span>
          <span>03 · Acompanhe</span>
        </div>
      </section>
      <form
        className="login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError("");
          setCredentials(name, password);
          try {
            await api("/me");
            onLogin();
          } catch (e) {
            clearCredentials();
            setError((e as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        <span className="eyebrow">CENTRAL DE OPERAÇÕES</span>
        <h2>Bem-vindo de volta</h2>
        <p>Entre para acompanhar sua operação.</p>
        <label>
          Usuário
          <input
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button disabled={pending}>
          {pending ? "Entrando…" : "Entrar na central"}
          <ArrowUpRight size={16} />
        </Button>
        <small>
          <ShieldCheck size={14} />
          Acesso autenticado · ações registradas
        </small>
      </form>
    </main>
  );
}
export default function App() {
  const [logged, setLogged] = useState(false),
    [view, setView] = useState("dashboard"),
    [form, setForm] = useState(false),
    [lead, setLead] = useState<string | null>(null);
  const client = useQueryClient();
  const user = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/me"),
    enabled: logged,
    retry: false,
  });
  if (!logged) return <Login onLogin={() => setLogged(true)} />;
  const selected = nav.find((n) => n.id === view) || nav[0];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#" className="brand" onClick={() => setView("dashboard")}>
          <span className="brand-icon">
            <Workflow size={20} />
          </span>
          <span>
            automation<strong>center</strong>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">AC</span>
          <div>
            <strong>Operação principal</strong>
            <small>Atendimento & distribuição</small>
          </div>
        </div>
        <span className="nav-label">OPERAÇÃO</span>
        <nav>
          {nav.map((n, index) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => setView(n.id)}
              aria-label={n.name}
              aria-current={view === n.id ? "page" : undefined}
            >
              <span className="nav-index" aria-hidden="true">0{index + 1}</span>
              <n.icon size={17} />
              {n.name}
              {view === n.id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" />
          <strong>Automação com supervisão</strong>
          <p>
            O agente sugere.
            <br />
            Sua equipe decide.
          </p>
          <ShieldCheck size={20} />
        </div>
        <footer>
          <span className="avatar">
            {user.data?.username.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{user.data?.username || "Carregando"}</strong>
            <small>
              {user.data?.canWrite ? "Operador" : "Somente leitura"}
            </small>
          </div>
          <button
            aria-label="Sair"
            onClick={() => {
              clearCredentials();
              client.clear();
              setLogged(false);
            }}
          >
            <LogOut size={17} />
          </button>
        </footer>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Central de operações <ChevronRight size={14} />
            <strong>{selected.name}</strong>
          </div>
          <span className="topbar-date">
            {new Date().toLocaleDateString("pt-BR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span className="avatar blue">AC</span>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <span className="page-kicker">PAINEL / 0{nav.findIndex((n) => n.id === view) + 1}</span>
              <h1>{selected.name}</h1>
              <p>
                {
                  (
                    {
                      dashboard:
                        "Entradas, capacidade e pontos de atenção da operação.",
                      leads:
                        "Todas as entradas, organizadas para o próximo passo.",
                      kanban:
                        "Distribua, acompanhe e avance o trabalho da sua equipe.",
                      logs: "Entenda as falhas e retome o fluxo de atendimento.",
                    } as Record<string, string>
                  )[view]
                }
              </p>
            </div>
            <Button
              disabled={!user.data?.canWrite}
              onClick={() => setForm(true)}
            >
              <Plus size={16} />
              Novo lead
            </Button>
          </div>
          <ActionTabs
            items={nav.map((n) => ({ id: n.id, label: n.name }))}
            value={view}
            onChange={setView}
          />
          <Suspense
            fallback={<div className="loading">Carregando operação…</div>}
          >
            {user.error ? (
              <p role="alert" className="error">
                {user.error.message}
              </p>
            ) : view === "dashboard" ? (
              <Dashboard onNavigate={setView} />
            ) : view === "kanban" ? (
              <Kanban canWrite={!!user.data?.canWrite} onOpen={setLead} />
            ) : view === "leads" ? (
              <LeadTable onOpen={setLead} />
            ) : (
              <IntegrationLogs canWrite={!!user.data?.canWrite} />
            )}
          </Suspense>
          <footer className="main-footer">
            <span>Automation Center</span>
            <span>Eventos rastreáveis. Decisões humanas.</span>
          </footer>
        </main>
      </div>
      {form && user.data?.canWrite && (
        <LeadForm onClose={() => setForm(false)} />
      )}
      <LeadDrawer
        id={lead}
        onClose={() => setLead(null)}
        canWrite={!!user.data?.canWrite}
      />
    </div>
  );
}
