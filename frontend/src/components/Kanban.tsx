import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "motion/react";
import { GripVertical, Clock, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { api, allPages } from "@/lib/api";
import { labels, statuses, type Task, type Status } from "@/types";
import { EmptyQueue } from "./kokonut/EmptyQueue";
export function useTaskMove() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ task, status }: { task: Task; status: Status }) =>
      api<Task>(`/tasks/${task.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, version: task.version }),
      }),
    onMutate: async ({ task, status }) => {
      await client.cancelQueries({ queryKey: ["tasks"] });
      const previous = client.getQueryData<Task[]>(["tasks"]);
      client.setQueryData<Task[]>(["tasks"], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, status } : t)),
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      client.setQueryData(["tasks"], context?.previous);
      toast.error(`Movimentação revertida: ${error.message}`);
    },
    onSuccess: () => toast.success("Tarefa atualizada"),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["tasks"] });
      client.invalidateQueries({ queryKey: ["metrics"] });
      client.invalidateQueries({ queryKey: ["leads"] });
      client.invalidateQueries({ queryKey: ["lead"] });
      client.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}
function TaskCard({
  task,
  disabled,
  onOpen,
  overlay = false,
}: {
  task: Task;
  disabled: boolean;
  onOpen: (id: string) => void;
  overlay?: boolean;
}) {
  const drag = useDraggable({
    id: overlay ? `overlay-${task.id}` : task.id,
    disabled: disabled || overlay,
  });
  const late = new Date(task.due_at) < new Date() && task.status !== "RESOLVED";
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: drag.isDragging ? 0.25 : 1, y: 0 }}
      ref={drag.setNodeRef}
      style={{ transform: CSS.Translate.toString(drag.transform) }}
      className={`task-card ${overlay ? "drag-overlay" : ""}`}
    >
      <div className="flex justify-between">
        <span className={`priority ${task.priority.toLowerCase()}`}>
          {task.priority === "HIGH" || task.priority === "URGENT"
            ? "Alta prioridade"
            : "Normal"}
        </span>
        <button
          {...drag.listeners}
          {...drag.attributes}
          disabled={disabled}
          aria-label={`Mover ${task.customer_name}`}
          className="drag-handle"
        >
          <GripVertical size={16} />
        </button>
      </div>
      <button className="card-open" onClick={() => onOpen(task.lead)}>
        <h3>{task.title}</h3>
        <span>{task.customer_name}</span>
      </button>
      <div className="card-tags">
        <span>{task.channel}</span>
        <span>{task.team}</span>
      </div>
      <div className="card-footer">
        <span className={late ? "late" : ""}>
          <Clock size={13} />
          {late
            ? "SLA vencido"
            : new Date(task.due_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
        </span>
        <span className="avatar" title={task.assignee || "Equipe"}>
          {(task.assignee || task.team).slice(0, 2).toUpperCase()}
        </span>
      </div>
    </motion.article>
  );
}
function Column({
  status,
  tasks,
  disabled,
  onOpen,
  onMove,
}: {
  status: Status;
  tasks: Task[];
  disabled: boolean;
  onOpen: (id: string) => void;
  onMove: (task: Task, status: Status) => void;
}) {
  const drop = useDroppable({ id: status, disabled });
  return (
    <section
      ref={drop.setNodeRef}
      className={`kanban-column ${drop.isOver ? "drop-active" : ""}`}
    >
      <header>
        <span className={`status-dot ${status.toLowerCase()}`} />
        <h3>{labels[status]}</h3>
        <span className="count">{tasks.length}</span>
      </header>
      <div className="column-cards">
        {tasks.map((task) => (
          <div key={task.id}>
            <TaskCard task={task} disabled={disabled} onOpen={onOpen} />
            <label className="move-select">
              Mover para
              <select
                aria-label={`Status de ${task.customer_name}`}
                value={task.status}
                disabled={disabled}
                onChange={(e) => onMove(task, e.target.value as Status)}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {labels[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
        {tasks.length === 0 && <EmptyQueue />}
      </div>
    </section>
  );
}
export function Kanban({
  canWrite,
  onOpen,
}: {
  canWrite: boolean;
  onOpen: (id: string) => void;
}) {
  const query = useQuery({
    queryKey: ["tasks"],
    queryFn: () => allPages<Task>("/tasks"),
    refetchInterval: 15000,
  });
  const move = useTaskMove();
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const tasks = query.data || [];
  function end(event: DragEndEvent) {
    setActive(null);
    const task = tasks.find((t) => t.id === event.active.id);
    const target = event.over?.id as Status;
    if (
      task &&
      target &&
      statuses.includes(target) &&
      task.status !== target &&
      canWrite
    )
      move.mutate({ task, status: target });
  }
  if (query.isPending) return <div className="loading">Carregando filas…</div>;
  if (query.error)
    return (
      <div role="alert" className="error">
        {query.error.message}
      </div>
    );
  return (
    <>
      <div className="view-toolbar">
        <span>
          <span className="live-dot" /> {tasks.length} tarefas · atualização a
          cada 15 segundos
        </span>
        <span className="muted">
          Arraste ou use “Mover para” <ArrowUpRight size={14} />
        </span>
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={(e) =>
          setActive(tasks.find((t) => t.id === e.active.id) || null)
        }
        onDragEnd={end}
        onDragCancel={() => setActive(null)}
      >
        <div className="kanban-board">
          {statuses.map((s) => (
            <Column
              key={s}
              status={s}
              tasks={tasks.filter((t) => t.status === s)}
              disabled={!canWrite || move.isPending}
              onOpen={onOpen}
              onMove={(task, status) => move.mutate({ task, status })}
            />
          ))}
        </div>
        <DragOverlay>
          {active && (
            <TaskCard task={active} disabled onOpen={onOpen} overlay />
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}
