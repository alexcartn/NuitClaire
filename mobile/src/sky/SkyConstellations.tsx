import { useMemo } from "react";
import { Section } from "../components/Section";
import { listConstellations } from "./constellationList";
import { lstDeg, sectorOf } from "./sky";
import type { SkyFound } from "./SkySearch";
import { CONSTELLATIONS } from "./skyNames";

/** Toutes les constellations a parcourir, celles qui sont dans le ciel a
 * l'heure affichee d'abord. Un choix centre la carte dessus et ouvre sa
 * fiche, comme dans la recherche. */
export function SkyConstellations({ when, site, activeId, onChoose }: {
  when: Date;
  site: { lat: number; lon: number };
  activeId: string | null;
  onChoose: (f: SkyFound) => void;
}) {
  // A la minute pres : le ciel ne bouge pas assez vite pour refaire le tri
  // a chaque rendu.
  const minute = Math.floor(when.getTime() / 60000);
  const items = useMemo(
    () => listConstellations(CONSTELLATIONS, site.lat, lstDeg(new Date(minute * 60000), site.lon)),
    [minute, site.lat, site.lon],
  );
  const upCount = items.filter((c) => c.up).length;

  return (
    <Section id="ciel-constellations" title="Constellations" summary={`${upCount} dans le ciel`} defaultOpen={false}>
      <div className="nc-sky-const-list" role="list">
        {items.map((c, i) => (
          <div key={c.id} role="listitem">
            {(i === 0 || items[i - 1].up !== c.up) && (
              <span className="nc-caption nc-sky-const-group">{c.up ? "Dans le ciel" : "Sous l'horizon"}</span>
            )}
            <button
              onClick={() => onChoose({ name: c.name, constellation: { id: c.id, raDeg: c.raDeg, decDeg: c.decDeg } })}
              className={c.id === activeId ? "nc-sky-const-item nc-sky-const-item-active" : "nc-sky-const-item"}
              aria-pressed={c.id === activeId}
            >
              <span>{c.name}</span>
              {c.up && <span className="nc-caption nc-num">{Math.round(c.alt)}° · {sectorOf(c.az)}</span>}
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}
