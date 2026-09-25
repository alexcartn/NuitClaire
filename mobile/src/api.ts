import type {
  AppState,
  Feeling,
  ExposureEntry,
  GeocodeResult,
  MessierSeason,
  Night,
  NightBrief,
  NightConditions,
  NoteContext,
  Sessions,
  Settings,
  SettingsUpdate,
  Site,
  StarHop,
  Stats,
  TargetDetail,
  TargetRow,
  TargetSuggestion,
} from "./types";

import { readText, writeText } from "./storage";
import type { IssInfo, MoonTonight, PlanetTonight, SkyBodies } from "./sky/types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

/** Code d'acces de l'API (voir api/auth.py), saisi une fois sur l'appareil.
 * Pas dans le bundle : celui-ci est public, n'importe qui l'ouvre. */
const TOKEN_KEY = "nc-api-token";

export function getApiToken(): string | null {
  return readText(TOKEN_KEY);
}

export function setApiToken(token: string | null): void {
  writeText(TOKEN_KEY, token && token.trim() ? token.trim() : null);
}

/** Emis quand le serveur refuse le code d'acces : App.tsx affiche alors la
 * demande de code, quel que soit l'ecran qui a fait la requete. */
export const UNAUTHORIZED_EVENT = "nc-unauthorized";

/** Erreur HTTP portant son code : la file d'attente du journal (voir
 * sessionQueue.ts) doit distinguer un refus du serveur (4xx, definitif --
 * rejouer l'operation echouera toujours) d'une panne reseau ou serveur
 * (fetch qui rejette, 5xx -- a reessayer plus tard). Sans le code, les deux
 * se ressemblent et une operation invalide bloquerait la file pour toujours. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getApiToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ApiError(detail?.detail ?? `${path} -> ${res.status}`, res.status);
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
  reverseGeocode: (lat: number, lon: number) =>
    request<{ name: string }>("POST", "/api/geocode/reverse", { body: { lat, lon } }),
  updateHorizon: (sector: string, open: boolean, minAlt?: number) =>
    request<Record<string, boolean>>("PUT", "/api/horizon", { body: { sector, open, minAlt } }),
  deletePlace: (name: string) => request<Settings>("DELETE", `/api/places/${encodeURIComponent(name)}`),
  updateMessierCapture: (id: string, captured: boolean) =>
    request<string[]>("PUT", `/api/messier/${encodeURIComponent(id)}`, { body: { captured } }),

  night: () => get<Night>("/api/night"),
  nights: () => get<NightBrief[]>("/api/nights"),
  targets: (types?: string[]) => get<TargetRow[]>("/api/targets", types?.length ? { types } : undefined),
  messier: (onlyFeasible?: boolean) =>
    get<TargetRow[]>("/api/messier", onlyFeasible ? { onlyFeasible: "true" } : undefined),
  messierSeason: () => get<MessierSeason[]>("/api/messier/season"),
  search: (q: string) => get<TargetRow[]>("/api/search", { q }),
  searchSuggest: (q: string, limit = 8) =>
    get<TargetSuggestion[]>("/api/search/suggest", { q, limit: String(limit) }),
  skyBodies: () => get<SkyBodies>("/api/sky/bodies"),
  moonTonight: () => get<MoonTonight>("/api/extras/moon"),
  planetsTonight: () => get<PlanetTonight[]>("/api/extras/planets"),
  iss: () => get<IssInfo>("/api/extras/iss"),
  starHop: (designation: string) => get<StarHop>(`/api/targets/${encodeURIComponent(designation)}/starhop`),
  updateMessierSeen: (id: string, seen: boolean) =>
    request<string[]>("PUT", `/api/messier/${encodeURIComponent(id)}/seen`, { body: { seen } }),
  targetDetail: (designation: string) =>
    get<TargetDetail>(`/api/targets/${encodeURIComponent(designation)}`),

  sessions: () => get<Sessions>("/api/sessions"),
  // `at` : l'heure de saisie cote client. Une saisie faite hors ligne part
  // quand le reseau revient, parfois des heures plus tard -- sans elle,
  // l'entree porterait l'heure de la synchronisation (voir sessionQueue.ts).
  addSessionItem: (designation: string, at?: string) =>
    request<Sessions>("POST", "/api/sessions/current/items", { body: { designation, at } }),
  updateSessionItem: (
    designation: string,
    update: { done?: boolean; exposureMin?: number; rating?: number | null },
  ) =>
    request<Sessions>("PUT", `/api/sessions/current/items/${encodeURIComponent(designation)}`, {
      body: update,
    }),
  deleteSessionItem: (designation: string) =>
    request<Sessions>("DELETE", `/api/sessions/current/items/${encodeURIComponent(designation)}`),
  addItemNote: (designation: string, text: string, at?: string, context?: NoteContext | null) =>
    request<Sessions>("POST", `/api/sessions/current/items/${encodeURIComponent(designation)}/notes`, {
      body: { text, at, context },
    }),
  deleteItemNote: (designation: string, noteId: string) =>
    request<Sessions>(
      "DELETE",
      `/api/sessions/current/items/${encodeURIComponent(designation)}/notes/${encodeURIComponent(noteId)}`,
    ),
  addFreeNote: (text: string, at?: string, context?: NoteContext | null) =>
    request<Sessions>("POST", "/api/sessions/current/notes", { body: { text, at, context } }),
  updateFeeling: (patch: Partial<Feeling>) =>
    request<Sessions>("PUT", "/api/sessions/current/feeling", { body: patch }),
  updateCurrentSite: (site: Site) =>
    request<Sessions>("PUT", "/api/sessions/current/site", { body: site }),
  deleteFreeNote: (noteId: string) =>
    request<Sessions>("DELETE", `/api/sessions/current/notes/${encodeURIComponent(noteId)}`),
  closeSession: (at?: string, conditions?: NightConditions | null) =>
    request<Sessions>("POST", "/api/sessions/current/close", { body: { at, conditions } }),
  updatePastSession: (closedAt: string, patch: { note?: string; site?: Site } & Partial<Feeling>) =>
    request<Sessions>("PUT", `/api/sessions/past/${encodeURIComponent(closedAt)}`, { body: patch }),
  reopenSession: (closedAt: string) =>
    request<Sessions>("POST", `/api/sessions/past/${encodeURIComponent(closedAt)}/reopen`),

  stats: () => get<Stats>("/api/stats"),

  pushKey: () => get<{ publicKey: string }>("/api/push/key"),
  pushSubscribe: (subscription: PushSubscriptionJSON) =>
    request<{ subscriptions: number }>("POST", "/api/push/subscriptions", { body: subscription }),
  pushUnsubscribe: (endpoint: string) =>
    request<{ subscriptions: number }>("DELETE", "/api/push/subscriptions", { body: { endpoint } }),
  pushTest: () => request<{ sent: number; failed: number; removed: number }>("POST", "/api/push/test"),

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
