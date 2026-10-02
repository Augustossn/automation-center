import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCw, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { type Log, type Page } from "@/types";
import { Button } from "./ui/button";
import { ActionButton } from "./microkit/ActionButton";
export function IntegrationLogs({ canWrite }: { canWrite: boolean }) {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["logs", filter, page],
    queryFn: () =>
      api<Page<Log>>(`/integration-logs?status=${filter}&page=${page}`),
    refetchInterval: 15000,
  });
  const retry = useMutation({
    mutationFn: (id: string) =>
      api(`/integration-logs/${id}/reprocess`, { method: "POST" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["logs"] });
      toast.success("Reprocessamento agendado");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <>
      <div className="notice">
        <AlertTriangle size={18} />
        <span>
          Falhas têm rastreabilidade. Reprocessamentos usam tentativas limitadas
          e espera progressiva.
        </span>
      </div>
      <section className="panel">
        <div className="table-tools">
          <h3>Histórico de integrações</h3>
          <select
            aria-label="Filtrar logs"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os resultados</option>
            {["FAILED", "RETRYING", "PENDING", "SUCCESS"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {query.error && (
          <p role="alert" className="error">
            {query.error.message}
          </p>
        )}
        {query.data?.results.map((log) => (
          <article className="log-row" key={log.id}>
            <div className="log-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="log-content">
              <div className="flex gap-3 items-center">
                <h3>{log.integration.toUpperCase()} · sincronização de lead</h3>
                <span className={`badge ${log.status.toLowerCase()}`}>
                  {log.status}
                </span>
              </div>
              <p>{log.error || "Integração processada"}</p>
              <div className="muted">
                {new Date(log.created_at).toLocaleString("pt-BR")} · Tentativa{" "}
                {log.attempt} · {log.id.slice(0, 8)}
              </div>
              <details>
                <summary>
                  Payload mascarado <ChevronDown size={13} />
                </summary>
                <pre>{JSON.stringify(log.payload, null, 2)}</pre>
              </details>
            </div>
            <ActionButton
              pending={retry.isPending && retry.variables === log.id}
              success={retry.isSuccess && retry.variables === log.id}
              variant="outline"
              disabled={!canWrite || retry.isPending || log.status !== "FAILED"}
              onClick={() => retry.mutate(log.id)}
            >
              <RotateCw size={14} />
              Reprocessar
            </ActionButton>
          </article>
        ))}
        {query.isPending && <p className="loading">Carregando logs…</p>}
        {query.data?.count === 0 && (
          <p className="empty-table">Nenhum registro para este filtro.</p>
        )}
        <footer className="pagination">
          <span>{query.data?.count || 0} registros</span>
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!query.data?.next}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </footer>
      </section>
    </>
  );
}
