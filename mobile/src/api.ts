import type {
  AppState,
  ExposureEntry,
  GeocodeResult,
  Night,
  Sessions,
  Settings,
  SettingsUpdate,
  Stats,
  TargetDetail,
  TargetRow,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function request<T>(
  method: string,
  path: string,
  { params, body }: { params?: Record<string, string | string[]>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const get = <T>(path: string, params?: Record<string, string | string[]>) =>
  request<T>("GET", path, { params });

export const api = {
  state: () => get<AppState>("/api/state"),
  settings: () => get<Settings>("/api/settings"),
  updateSettings: (update: SettingsUpdate) => request<Settings>("PUT", "/api/settings", { body: update }),
  geocode: (address: string) => request<GeocodeResult>("POST", "/api/geocode", { body: { address } }),
  updateHorizon: (sector: string, open: boolean) =>
    request<Record<string, boolean>>("PUT", "/api/horizon", { body: { sector, open } }),
  updateMessierCapture: (id: string, captured: boolean) =>
    request<string[]>("PUT", `/api/messier/${encodeURIComponent(id)}`, { body: { captured } }),

  night: () => get<Night>("/api/night"),
  targets: (types?: string[]) => get<TargetRow[]>("/api/targets", types?.length ? { types } : undefined),
  messier: (onlyFeasible?: boolean) =>
    get<TargetRow[]>("/api/messier", onlyFeasible ? { onlyFeasible: "true" } : undefined),
  search: (q: string) => get<TargetRow[]>("/api/search", { q }),
  targetDetail: (designation: string) =>
    get<TargetDetail>(`/api/targets/${encodeURIComponent(designation)}`),

  sessions: () => get<Sessions>("/api/sessions"),
  addSessionItem: (designation: string) =>
    request<Sessions>("POST", "/api/sessions/current/items", { body: { designation } }),
  updateSessionItem: (designation: string, update: { done?: boolean; exposureMin?: number }) =>
    request<Sessions>("PUT", `/api/sessions/current/items/${encodeURIComponent(designation)}`, {
      body: update,
    }),
  deleteSessionItem: (designation: string) =>
    request<Sessions>("DELETE", `/api/sessions/current/items/${encodeURIComponent(designation)}`),
  addItemNote: (designation: string, text: string) =>
    request<Sessions>("POST", `/api/sessions/current/items/${encodeURIComponent(designation)}/notes`, {
      body: { text },
    }),
  deleteItemNote: (designation: string, noteId: string) =>
    request<Sessions>(
      "DELETE",
      `/api/sessions/current/items/${encodeURIComponent(designation)}/notes/${encodeURIComponent(noteId)}`,
    ),
  addFreeNote: (text: string) =>
    request<Sessions>("POST", "/api/sessions/current/notes", { body: { text } }),
  deleteFreeNote: (noteId: string) =>
    request<Sessions>("DELETE", `/api/sessions/current/notes/${encodeURIComponent(noteId)}`),
  closeSession: () => request<Sessions>("POST", "/api/sessions/current/close"),
  updatePastSessionNote: (closedAt: string, note: string) =>
    request<Sessions>("PUT", `/api/sessions/past/${encodeURIComponent(closedAt)}`, { body: { note } }),
  reopenSession: (closedAt: string) =>
    request<Sessions>("POST", `/api/sessions/past/${encodeURIComponent(closedAt)}/reopen`),

  stats: () => get<Stats>("/api/stats"),

  addTargetExposure: (designation: string, minutes: number) =>
    request<ExposureEntry[]>("POST", `/api/progress/exposure/${encodeURIComponent(designation)}`, {
      body: { minutes },
    }),
  deleteTargetExposure: (designation: string, entryId: string) =>
    request<ExposureEntry[]>(
      "DELETE",
      `/api/progress/exposure/${encodeURIComponent(designation)}/${encodeURIComponent(entryId)}`,
    ),
};
