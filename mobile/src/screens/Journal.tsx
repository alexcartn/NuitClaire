import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { applyServer, mutate, refresh, useSessions } from "../useSessions";
import { closeOp, newOp } from "../sessionQueue";
import type { SessionOpBody } from "../sessionQueue";
import { knownSites } from "../journalRead";
import { useWakeLock } from "../useWakeLock";
import { plural } from "../format";
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
  const fetchStats = useCallback(() => api.stats(), []);
  // Le lieu configure : c'est justement celui qu'on vient de poser dans
  // Reglages en rentrant, et qui n'est encore dans aucune sortie.
  const fetchState = useCallback(() => api.state(), []);
  const { data: appState, reload: reloadAppState } = useFetch(fetchState, [], "state");
  const { data: stats, reload: reloadStats } = useFetch(fetchStats, []);
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

  return (
    <div className="nc-screen">
      <ScreenHeader
        eyebrow="Journal de session"
        title={plural(past.length, "sortie enregistrée", "sorties enregistrées")}
      />

      <SyncBanner pendingCount={pendingCount} syncError={syncError} loadError={loadError} />

      <AddToSession items={current.items} send={send} />

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

      <PastOutings
        data={data}
        places={places}
        sessionActive={sessionActive}
        pendingCount={pendingCount}
        reopening={reopening}
        reopenError={reopenError}
        onSave={savePastSession}
        onReopen={reopen}
        onOpenTarget={onOpenTarget}
      />

      {stats && <JournalStats stats={stats} />}
    </div>
  );
}
