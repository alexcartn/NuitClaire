import { RangeSlider } from "./RangeSlider";

/** Filtres partages par « Cibles » et « Catalogue Messier » : types d'objet
 * (puces a defilement horizontal) et plage de magnitude. Le meme bloc etait
 * recopie dans les deux ecrans. */
export function TypeChips({
  types,
  selected,
  onToggle,
}: {
  types: string[];
  selected: string[];
  onToggle: (type: string) => void;
}) {
  if (types.length === 0) return null;
  return (
    <div className="nc-row nc-hscroll">
      {types.map((t) => (
        <button
          key={t}
          onClick={() => onToggle(t)}
          className={`nc-chip nc-none ${selected.includes(t) ? "nc-chip-active" : ""}`}
          aria-pressed={selected.includes(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function MagnitudeFilter({
  bounds,
  value,
  onChange,
}: {
  bounds: { min: number; max: number } | null;
  value: [number, number] | null;
  onChange: (value: [number, number]) => void;
}) {
  if (!bounds || bounds.max <= bounds.min) return null;
  const [lo, hi] = value ?? [bounds.min, bounds.max];
  return (
    <div className="nc-stack-xs">
      <span className="nc-caption">
        Magnitude <span className="nc-num">{lo.toFixed(1)} → {hi.toFixed(1)}</span>
      </span>
      <RangeSlider min={bounds.min} max={bounds.max} step={0.5} value={[lo, hi]} onChange={onChange} />
    </div>
  );
}

/** Bornes de magnitude derivees des lignes chargees (pas fixes) : la plage
 * varie selon le catalogue et les types choisis, le curseur doit couvrir
 * tout ce qui est effectivement affichable. */
export function magnitudeBounds(rows: { mag: number | null }[] | null): { min: number; max: number } | null {
  const values = (rows ?? []).map((r) => r.mag).filter((m): m is number => m != null);
  if (!values.length) return null;
  return { min: Math.floor(Math.min(...values)), max: Math.ceil(Math.max(...values)) };
}

export function distinctTypes(rows: { type: string }[] | null): string[] {
  return [...new Set((rows ?? []).map((r) => r.type))].sort();
}
