/** Deux segments en tete de « Cibles » et de l'objectif Messier : les deux
 * ecrans listent des cibles, l'un pour ce soir, l'autre pour le catalogue
 * des 110. Ils partagent un onglet de la barre pour laisser la place a la
 * carte du ciel. */
export function CiblesSwitch({ active, onSelect }: {
  active: "cibles" | "messier";
  onSelect: (screen: "cibles" | "messier") => void;
}) {
  const segments: { key: "cibles" | "messier"; label: string }[] = [
    { key: "cibles", label: "Cibles ce soir" },
    { key: "messier", label: "Objectif Messier" },
  ];
  return (
    <div className="nc-seg" role="tablist" aria-label="Liste de cibles">
      {segments.map((s) => (
        <button
          key={s.key}
          role="tab"
          aria-selected={active === s.key}
          onClick={() => active !== s.key && onSelect(s.key)}
          className={`nc-seg-btn ${active === s.key ? "nc-seg-btn-active" : ""}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
