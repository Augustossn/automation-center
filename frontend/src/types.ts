export const statuses = [
  "NEW",
  "CLASSIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "RESOLVED",
  "FAILED",
] as const;
export type Status = (typeof statuses)[number];
export const labels: Record<Status, string> = {
  NEW: "Novo",
  CLASSIFIED: "Classificado",
  ASSIGNED: "Na fila",
  IN_PROGRESS: "Em andamento",
  WAITING_CUSTOMER: "Aguardando cliente",
  RESOLVED: "Resolvido",
  FAILED: "Falha",
};
export type Lead = {
  id: string;
  customer: { id?: string; name: string; email: string; phone: string };
  channel: string;
  content: string;
  status: Status;
  category: string;
  priority: string;
  tags: string[];
  created_at: string;
};
export type Task = {
  id: string;
  lead: string;
  title: string;
  customer_name: string;
  channel: string;
  team: string;
  priority: string;
  status: Status;
  version: number;
  due_at: string;
  assignee: string | null;
};
export type Log = {
  id: string;
  lead: string;
  integration: string;
  status: string;
  attempt: number;
  error: string;
  payload: Record<string, unknown>;
  created_at: string;
};
export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
export type User = { username: string; canWrite: boolean; isAdmin: boolean };
export type Recommendation = {
  id: string;
  result: {
    category: string;
    priority: string;
    confidence: number;
    extractedEntities: Record<string, unknown>;
    suggestedTeam: string;
    recommendedAction: string;
    draftResponse: string | null;
    requiresHumanApproval: boolean;
  };
  decision: string;
  reason: string;
};
export type Timeline = {
  events: {
    id: string;
    topic: string;
    created_at: string;
    published: boolean;
    processed: boolean;
  }[];
  recommendations: Recommendation[];
};
export type Metrics = {
  totalLeads: number;
  openTasks: number;
  resolvedTasks: number;
  slaBreached: number;
  slaCompliance: number;
  integrationFailures: number;
  automations: number;
  channels: { channel__name: string; count: number }[];
  statuses: { status: string; count: number }[];
  daily: { day: string; count: number }[];
};
