import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Clock,
  Workflow,
  Activity,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { type Metrics } from "@/types";
import { OperationalChart } from "./bklit/OperationalChart";
export function Dashboard({
  onNavigate,
}: {
  onNavigate: (view: string) => void;
}) {
  const query = useQuery({
    queryKey: ["metrics"],
    queryFn: () => api<Metrics>("/dashboard/metrics"),
    refetchInterval: 15000,
  });
  if (query.error)
    return (
      <div role="alert" className="error">
        {query.error.message}
      </div>
    );
  if (!query.data)
    return <div className="loading">Carregando indicadores…</div>;
  const m = query.data;
  return (
    <>
      <div className="dashboard-intro">
        <div>
          <span className="eyebrow">PULSO DA OPERAÇÃO</span>
          <p>Leitura atual das filas de atendimento</p>
        </div>
        <span className="live-badge">
          <span className="live-dot" />
          Atualização contínua
        </span>
      </div>
      <div className="metrics-grid">
        {[
          {
            label: "Leads recebidos",
            value: m.totalLeads,
            icon: Users,
            note: "Entradas centralizadas",
            tone: "blue",
          },
          {
            label: "Tarefas em aberto",
            value: m.openTasks,
            icon: Clock,
            note: `${m.slaBreached} com SLA vencido`,
            tone: "amber",
          },
          {
            label: "Conformidade de SLA",
            value: `${m.slaCompliance}%`,
            icon: ShieldCheck,
            note: "Entre as tarefas abertas",
            tone: "green",
          },
          {
            label: "Automações ativas",
            value: m.automations,
            icon: Workflow,
            note: "Regras de distribuição",
            tone: "purple",
          },
        ].map((item) => (
          <article className="metric-card" key={item.label}>
            <div className="flex justify-between">
              <span>{item.label}</span>
              <span className={`metric-icon ${item.tone}`}>
                <item.icon size={18} />
              </span>
            </div>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </div>
      <div className="chart-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Volume de entradas</h3>
              <p>Leads recebidos por dia</p>
            </div>
            <span className="badge">Histórico operacional</span>
          </div>
          <OperationalChart
            data={m.daily.map((d) => ({ date: d.day, value: d.count }))}
          />
        </section>
        <section className="panel channel-panel">
          <div className="panel-heading">
            <div>
              <h3>Origem dos leads</h3>
              <p>Distribuição por canal</p>
            </div>
            <Activity size={17} />
          </div>
          <div className="channel-total">
            <strong>{m.totalLeads}</strong>
            <span>entradas registradas</span>
          </div>
          {m.channels.map((channel, i) => (
            <div className="channel-item" key={channel.channel__name}>
              <div>
                <span>
                  <i
                    style={{
                      background: ["#586344", "#a18a69", "#394f52", "#b66c4c"][
                        i % 4
                      ],
                    }}
                  />
                  {channel.channel__name}
                </span>
                <strong>{channel.count}</strong>
              </div>
              <div className="channel-track">
                <span
                  style={{
                    width: `${(100 * channel.count) / Math.max(m.totalLeads, 1)}%`,
                    background: ["#586344", "#a18a69", "#394f52", "#b66c4c"][
                      i % 4
                    ],
                  }}
                />
              </div>
            </div>
          ))}
        </section>
      </div>
      <div className="bottom-grid">
        <section className="panel automation-summary">
          <span className="summary-icon">
            <Workflow size={24} />
          </span>
          <div>
            <h3>Do primeiro contato à próxima ação</h3>
            <p>
              Eventos classificam leads e distribuem tarefas. Sua equipe
              acompanha e decide.
            </p>
            <div className="pipeline">
              <span>Entrada</span>→<span>Classificação</span>→
              <span>Distribuição</span>→<span>Atendimento</span>
            </div>
          </div>
          <button
            onClick={() => onNavigate("kanban")}
            aria-label="Abrir Kanban"
          >
            <ArrowUpRight size={22} />
          </button>
        </section>
        <button
          className="panel failure-summary"
          onClick={() => onNavigate("logs")}
        >
          <span className="metric-icon amber">
            <Activity size={20} />
          </span>
          <div>
            <strong>{m.integrationFailures} falhas de integração</strong>
            <p>Revise o histórico e reprocese.</p>
          </div>
          <ArrowUpRight size={18} />
        </button>
      </div>
    </>
  );
}
