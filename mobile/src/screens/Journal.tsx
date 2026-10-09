import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { applyServer, mutate, refresh, useSessions } from "../useSessions";
import { closeOp, newOp } from "../sessionQueue";
import type { SessionOpBody } from "../sessionQueue";
import { knownSites } from "../journalRead";
import { latestMonth, outingYears } from "../journalView";
import { useRemembered } from "../useRemembered";
import { useWakeLock } from "../useWakeLock";
import { fmtHM, plural } from "../format";
import { ScreenHeader } from "../components/ScreenHeader";
import { SyncBanner } from "../journal/SyncBanner";
import { JournalStats } from "../journal/JournalStats";
import { AddToSession } from "../journal/AddToSession";
import { CurrentSessionCard } from "../journal/CurrentSessionCard";
import { PastOutings } from "../journal/PastOutings";
import { StartSuggestions } from "../journal/StartSuggestions";
import type { Feeling, Site } from "../types";

/** Le carnet : session en cours, puis sorties passees. Chaque bloc vit dans
 * src/journal/ ; ce fichier en faisait 900 lignes a lui seul. */
export function Journal({ onOpenTarget, onCaptureChange }: {
  onOpenTarget: (designation: string) => void;
  onCaptureChange: () => void;
}) {
  const { data, loading, loadError, pendingCount, pendingNotes, syncError, syncCount } = useSessions();
  // Annee choisie dans le calendrier des sorties : les statistiques la
  // suivent, d'ou son etat ici plutot que dans PastOutings.
  const years = outingYears(data?.past ?? []);
  const [year, setYear] = useRemembered(
    "journal:year",
    latestMonth(data?.past ?? [])?.year ?? new Date().getFullYear(),
  );
  const shownYear = years.includes(year) ? year : (years[0] ?? year);
  const fetchStats = useCallback(() => api.stats(shownYear), [shownYear]);
  // Le lieu configure : c'est justement celui qu'on vient de poser dans
  // Reglages en rentrant, et qui n'est encore dans aucune sortie.
  const fetchState = useCallback(() => api.state(), []);
  const { data: appState, reload: reloadAppState } = useFetch(fetchState, [], "state");
  const { data: stats, reload: reloadStats } = useFetch(fetchStats, [fetchStats]);
  const [reopening, setReopening] = useState<string | null>(null);
  const [reopenError, setReopenError] = useState<string | null>(null);

  // Les statistiques derivent du journal cote serveur : les recharger quand
  // une saisie vient d'y etre enregistree, pas a chaque frappe locale.
  useEffect(() => {
    if (syncCount > 0) reloadStats();
  }, [syncCount, reloadStats]);

  // Ecran maintenu allume pendant une sortie seulement (voir useWakeLock).
  // Appele avant tout retour anticipe : un hook ne se saute pas.
  const sessionActive = Boolean(
    data && (data.current.items.length > 0 || data.current.freeNotes.length > 0),
  );
  useWakeLock(sessionActive);

  if (loading || !data) {
    return (
      <div className="nc-screen">
        <p className="nc-caption">{loadError ?? "Chargement…"}</p>
      </div>
    );
  }

  const { current, past } = data;
  // Lieu courant en tete, puis ceux que le carnet connait deja, sans
  // doublon de nom.
  const places = [
    ...(appState ? [appState.site] : []),
    ...knownSites(data).filter((site) => site.name !== appState?.site.name),
  ];

  const send = (body: SessionOpBody) => mutate(newOp(body));

  // Fige au passage le resume des conditions sur la duree de la sortie (voir
  // nightContext.conditionsBetween) : le detail par note existe deja, la vue
  // d'ensemble serait sinon perdue.
  const close = () => mutate(closeOp(current.openedAt));

  const savePastSession = async (closedAt: string, patch: { note?: string; site?: Site } & Partial<Feeling>) => {
    // Retouche d'une sortie deja cloturee : pas une saisie de terrain, elle
    // peut rester un aller-retour direct (et le serveur valide `closedAt`).
    try {
      applyServer(await api.updatePastSession(closedAt, patch));
    } catch {
      refresh();
    }
  };

  const reopen = async (closedAt: string) => {
    setReopening(closedAt);
    setReopenError(null);
    try {
      applyServer(await api.reopenSession(closedAt));
    } catch (e) {
      setReopenError(e instanceof Error ? e.message : "Impossible de rouvrir cette sortie.");
    } finally {
      setReopening(null);
    }
  };

  const composer = <AddToSession items={current.items} send={send} docked={sessionActive} />;

  return (
    <div className="nc-screen">
      <ScreenHeader
        eyebrow={sessionActive ? "Journal" : "Journal de session"}
        title={sessionActive ? "Sortie en cours" : plural(past.length, "sortie enregistrée", "sorties enregistrées")}
        sub={
          sessionActive && current.openedAt ? (
            <span className="nc-num">
              depuis {fmtHM(current.openedAt)}
              {current.scoreAtOpen != null ? ` · score ${current.scoreAtOpen}` : ""}
            </span>
          ) : undefined
        }
      />

      <SyncBanner pendingCount={pendingCount} syncError={syncError} loadError={loadError} />

      {/* Grand ecran : la sortie (ou de quoi en commencer une) a gauche, le
          carnet des sorties passees et les statistiques a droite. */}
      <div className="nc-cols">
      <div className="nc-col">
      {/* Hors sortie, la saisie reste en tete ; pendant la sortie elle passe
          au bas de l'ecran (voir plus bas) et la page commence par les cibles. */}
      {!sessionActive && composer}

      {sessionActive ? (
        <CurrentSessionCard
          current={current}
          places={places}
          pendingNotes={pendingNotes}
          captured={new Set(appState?.messierCaptured ?? [])}
          onCaptureChange={() => {
            reloadAppState();
            onCaptureChange();
          }}
          send={send}
          onClose={close}
          onOpenTarget={onOpenTarget}
        />
      ) : (
        <StartSuggestions send={send} onOpenTarget={onOpenTarget} />
      )}
      </div>

      <div className="nc-col">
      <PastOutings
        data={data}
        year={shownYear}
        onYear={setYear}
        places={places}
        sessionActive={sessionActive}
        pendingCount={pendingCount}
        reopening={reopening}
        reopenError={reopenError}
        onSave={savePastSession}
        onReopen={reopen}
        onOpenTarget={onOpenTarget}
      />

      {stats && (
        <JournalStats
          stats={stats}
          year={shownYear}
          past={past}
          captured={appState?.messierCaptured ?? []}
          onOpenTarget={onOpenTarget}
        />
      )}
      </div>
      </div>

      {sessionActive && composer}
    </div>
  );
}
