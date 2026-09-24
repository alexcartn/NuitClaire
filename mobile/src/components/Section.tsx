import type { ReactNode } from "react";
import { useRemembered } from "../useRemembered";
import { TabIcon } from "./TabIcon";

/** Section repliable. L'etat ouvert/ferme survit a la navigation (voir
 * useRemembered) : revenir d'une fiche retrouve la page comme on l'a
 * laissee. Le nombre a droite dit ce qu'il y a dedans sans avoir a ouvrir. */
export function Section({
  id,
  title,
  count,
  summary,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  /** Resume du reglage en place (« Marson », « Nuit complete »), visible
   * section fermee. */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useRemembered(`section:${id}`, defaultOpen);
  return (
    <div className="nc-section">
      <button
        onClick={() => setOpen((v) => !v)}
        className="nc-section-head"
        aria-expanded={open}
        aria-controls={`section-${id}`}
      >
        <span className="nc-eyebrow">{title}</span>
        <span className="nc-row nc-none">
          {summary && <span className="nc-section-summary nc-ellipsis">{summary}</span>}
          {count != null && <span className="nc-num nc-section-count">{count}</span>}
          <span className={`nc-section-chevron ${open ? "nc-section-chevron-open" : ""}`}>
            <TabIcon name="chevron" />
          </span>
        </span>
      </button>
      {open && (
        <div id={`section-${id}`} className="nc-section-body">
          {children}
        </div>
      )}
    </div>
  );
}
