let credentials = "";
export function setCredentials(username: string, password: string) {
  credentials = btoa(unescape(encodeURIComponent(`${username}:${password}`)));
}
export function clearCredentials() {
  credentials = "";
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(credentials ? { Authorization: `Basic ${credentials}` } : {}),
      ...init.headers,
    },
  });
  const data = await response
    .json()
    .catch(() => ({ detail: "Resposta inválida do servidor" }));
  if (!response.ok) throw new Error(data.detail || JSON.stringify(data));
  return data as T;
}
export async function allPages<T>(path: string): Promise<T[]> {
  let result: T[] = [];
  let next: string | null = path;
  while (next) {
    const page: import("../types").Page<T> = await api(next);
    result.push(...page.results);
    next = page.next
      ? new URL(page.next, window.location.origin).pathname.replace(
          /^\/api/,
          "",
        ) + new URL(page.next, window.location.origin).search
      : null;
  }
  return result;
}
