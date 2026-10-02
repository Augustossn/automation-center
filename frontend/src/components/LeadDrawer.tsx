import { Drawer } from "vaul";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, ShieldCheck, RotateCw, BrainCircuit } from "lucide-react";
import { api } from "@/lib/api";
import { type Lead, type Timeline, labels } from "@/types";
import { Button } from "./ui/button";
export function LeadDrawer({
  id,
  onClose,
  canWrite,
}: {
  id: string | null;
  onClose: () => void;
  canWrite: boolean;
}) {
  const client = useQueryClient();
  const lead = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api<Lead>(`/leads/${id}`),
    enabled: !!id,
  });
  const timeline = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => api<Timeline>(`/leads/${id}/timeline`),
    enabled: !!id,
  });
  const action = useMutation({
    mutationFn: (name: string) =>
      api(`/leads/${id}/${name}`, { method: "POST" }),
    onSuccess: () => {
      client.invalidateQueries();
      toast.success("Ação registrada");
    },
    onError: (e) => toast.error(e.message),
  });
  const decide = useMutation({
    mutationFn: ({ rec, decision }: { rec: string; decision: string }) =>
      api(`/recommendations/${rec}/decide`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          reason: "Revisão humana pela central de operações",
        }),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["timeline", id] });
      toast.success("Decisão registrada para auditoria");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Drawer.Root
      open={!!id}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      direction={
        window.matchMedia("(min-width: 768px)").matches ? "right" : "bottom"
      }
    >
      <Drawer.Portal>
        <Drawer.Overlay className="drawer-overlay" />
        <Drawer.Content className="lead-drawer">
          <div className="drawer-handle" />
          <header className="flex justify-between">
            <div>
              <Drawer.Title>Detalhes do lead</Drawer.Title>
              <Drawer.Description>
                Histórico, classificação e decisões humanas.
              </Drawer.Description>
            </div>
            <Button
              variant="ghost"
              onClick={onClose}
              aria-label="Fechar detalhes"
            >
              <X size={18} />
            </Button>
          </header>
          {lead.error && (
            <p role="alert" className="error">
              {lead.error.message}
            </p>
          )}
          {lead.data && (
            <>
              <section className="lead-profile">
                <span className="avatar blue large">
                  {lead.data.customer.name.slice(0, 2).toUpperCase()}
                </span>
                <h2>{lead.data.customer.name}</h2>
                <p>{lead.data.customer.email}</p>
                <span className="badge">
                  {labels[lead.data.status]} · {lead.data.channel}
                </span>
              </section>
              <div className="detail-block">
                <h3>Solicitação</h3>
                <p>{lead.data.content}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!canWrite || action.isPending}
                  onClick={() => action.mutate("classify")}
                >
                  <BrainCircuit size={15} />
                  Classificar
                </Button>
                <Button
                  variant="outline"
                  disabled={!canWrite || action.isPending}
                  onClick={() => action.mutate("reprocess")}
                >
                  <RotateCw size={15} />
                  Reprocessar
                </Button>
              </div>
              <h3 className="mt-7 mb-3">Recomendações do agente</h3>
              {timeline.data?.recommendations.map((rec) => (
                <section className="recommendation" key={rec.id}>
                  <div className="flex gap-2 items-center">
                    <ShieldCheck size={17} />
                    <strong>
                      {Math.round(rec.result.confidence * 100)}% de confiança
                    </strong>
                    <span className="badge">{rec.decision}</span>
                  </div>
                  <p>{rec.result.recommendedAction}</p>
                  <small>
                    {rec.result.category} · {rec.result.priority} ·{" "}
                    {rec.result.suggestedTeam}
                  </small>
                  <pre>
                    {JSON.stringify(rec.result.extractedEntities, null, 2)}
                  </pre>
                  {rec.result.draftResponse ? (
                    <blockquote>{rec.result.draftResponse}</blockquote>
                  ) : (
                    <p className="error">
                      Conteúdo sensível: rascunho bloqueado.
                    </p>
                  )}
                  <small>
                    Rascunho para revisão. Nenhum envio externo é realizado.
                  </small>
                  {rec.decision === "PENDING" && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        disabled={!canWrite || decide.isPending}
                        onClick={() =>
                          decide.mutate({ rec: rec.id, decision: "APPROVED" })
                        }
                      >
                        Aprovar sugestão
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canWrite || decide.isPending}
                        onClick={() =>
                          decide.mutate({ rec: rec.id, decision: "REJECTED" })
                        }
                      >
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </section>
              ))}
              <h3 className="mt-7 mb-3">Linha do tempo</h3>
              {timeline.error && <p role="alert">{timeline.error.message}</p>}
              <ol className="timeline">
                {timeline.data?.events.map((event) => (
                  <li key={event.id}>
                    <strong>{event.topic}</strong>
                    <small>
                      {new Date(event.created_at).toLocaleString("pt-BR")} ·{" "}
                      {event.processed
                        ? "Processado"
                        : event.published
                          ? "Publicado"
                          : "Na fila"}
                    </small>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
