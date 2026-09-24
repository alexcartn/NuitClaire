/** Note de 1 a 5, ou rien. Cinq boutons chiffres plutot que des etoiles :
 * les glyphes d'etoile basculent en emoji couleur sur certains telephones,
 * ce qui ruinerait le mode vision nocturne. Reappuyer sur la valeur courante
 * l'efface. */
export function Rating({ label, scope, value, onChange }: {
  label: string;
  /** Ce que la note qualifie, ajoute au nom accessible. L'ecran porte
   * plusieurs "Satisfaction" -- une par cible, plus celle de la nuit -- que
   * le contexte visuel distingue, mais qui seraient indiscernables a la
   * voix. */
  scope: string;
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="nc-row nc-wrap">
      <span className="nc-caption nc-none">{label}</span>
      <div className="nc-row" style={{ gap: "var(--space-2xs)" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(value === n ? null : n)}
            className={`nc-chip ${value === n ? "nc-chip-active" : ""}`}
            aria-pressed={value === n}
            aria-label={`${label} ${scope} : ${n} sur 5`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
