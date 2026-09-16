import type { AppState, Night, Settings, TargetDetail, TargetRow } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function get<T>(path: string, params?: Record<string, string | string[]>): Promise<T> {
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  state: () => get<AppState>("/api/state"),
  settings: () => get<Settings>("/api/settings"),
  night: () => get<Night>("/api/night"),
  targets: (types?: string[]) =>
    get<TargetRow[]>("/api/targets", types?.length ? { types } : undefined),
  messier: (onlyFeasible?: boolean) =>
    get<TargetRow[]>("/api/messier", onlyFeasible ? { onlyFeasible: "true" } : undefined),
  search: (q: string) => get<TargetRow[]>("/api/search", { q }),
  targetDetail: (designation: string) =>
    get<TargetDetail>(`/api/targets/${encodeURIComponent(designation)}`),
};
