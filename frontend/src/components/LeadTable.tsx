import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Search, ArrowUpDown } from "lucide-react";
import { api } from "@/lib/api";
import { labels, statuses, type Lead, type Page } from "@/types";
import { Button } from "./ui/button";
export function LeadTable({ onOpen }: { onOpen: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const ordering = sorting.map((s) => (s.desc ? "-" : "") + s.id).join(",");
  const query = useQuery({
    queryKey: ["leads", search, filter, page, ordering],
    queryFn: () =>
      api<Page<Lead>>(
        `/leads?search=${encodeURIComponent(search)}&status=${filter}&page=${page + 1}&ordering=${ordering}`,
      ),
  });
  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        accessorKey: "customer.name",
        header: "Cliente",
        enableSorting: false,
        cell: (info) => (
          <button
            className="customer-cell"
            onClick={() => onOpen(info.row.original.id)}
          >
            <span className="avatar blue">
              {info.row.original.customer.name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{info.row.original.customer.name}</strong>
              <small>{info.row.original.customer.email}</small>
            </span>
          </button>
        ),
      },
      { accessorKey: "channel", header: "Canal", enableSorting: false },
      {
        accessorKey: "category",
        header: "Categoria",
        enableSorting: false,
        cell: (i) => i.getValue() || "A classificar",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (i) => (
          <span className={`badge ${String(i.getValue()).toLowerCase()}`}>
            {labels[i.getValue() as Lead["status"]]}
          </span>
        ),
      },
      { accessorKey: "priority", header: "Prioridade" },
      {
        accessorKey: "created_at",
        header: "Entrada",
        cell: (i) => new Date(String(i.getValue())).toLocaleDateString("pt-BR"),
      },
    ],
    [onOpen],
  );
  const table = useReactTable({
    data: query.data?.results || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPage(0);
    },
  });
  return (
    <section className="panel">
      <div className="table-tools">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Buscar leads"
            placeholder="Buscar por nome, e-mail ou solicitação…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          aria-label="Filtrar status"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todos os status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
      </div>
      {query.error && (
        <p role="alert" className="error">
          {query.error.message}
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th key={h.id}>
                    <button
                      disabled={!h.column.getCanSort()}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getCanSort() && <ArrowUpDown size={12} />}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id}>
                {r.getVisibleCells().map((c) => (
                  <td key={c.id}>
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!query.isPending && !query.data?.results.length && (
          <p className="empty-table">
            Nenhum lead encontrado com estes filtros.
          </p>
        )}
        {query.isPending && <p className="loading">Carregando leads…</p>}
      </div>
      <footer className="pagination">
        <span>
          {query.data?.count || 0} leads · página {page + 1}
        </span>
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!query.data?.next}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </footer>
    </section>
  );
}
