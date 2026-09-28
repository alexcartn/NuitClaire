import { useState, type CSSProperties, type ReactNode } from "react";
import { StatCard } from "../components/StatCard";
import { Section } from "../components/Section";
import { plural } from "../format";
import {
  localMonthKey,
  messierProgress,
  monthInitial,
  monthLabel,
  monthsOfYear,
  notesByHour,
  outingDurations,
  yearGrid,
} from "../statsView";
import { fmtExposure } from "./format";
import type { Family, FamilyCount, PastSession, Stats } from "../types";

type Measure = "outings" | "captures";

/** Statistiques de l'annee choisie dans le calendrier des sorties. */
export function JournalStats({ stats, year, past, captured, onOpenTarget }: {
  stats: Stats;
  year: number;
  past: PastSession[];
  captured: string[];
  onOpenTarget: (designation: string) => void;
}) {
  if (past.length === 0) return null;
  const now = new Date();
  const isThisYear = year === now.getFullYear();
  // L'annee en cours : le mois qui court. Une annee passee : son total.
  const capturesShown = isThisYear
    ? stats.capturesByMonth.find((m) => m.month === localMonthKey(now))?.count ?? 0
    : stats.capturesByMonth.reduce((sum, m) => sum + m.count, 0);
  return (
    // Repliee par defaut : utile a la relecture, pas pendant la saisie. Rien
    // en resume dans l'en-tete, les chiffres ne s'affichent qu'a la demande.
    <Section id="journal-stats" title={`Statistiques ${year}`} defaultOpen={false}>
      {stats.totalOutings === 0 ? (
        <p className="nc-caption">Aucune sortie en {year}.</p>
      ) : (
        <>
          {/* Le chiffre qui compte en tete, le reste en appui. */}
          <div className="nc-stack-xs">
            <div className="nc-row" style={{ alignItems: "baseline", gap: "var(--space-xs)" }}>
              <span className="nc-num" style={{ fontSize: "var(--text-xl)", fontWeight: 500 }}>{stats.totalOutings}</span>
              <span style={{ fontSize: "var(--text-sm)" }}>{stats.totalOutings < 2 ? "sortie" : "sorties"}</span>
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>
              {plural(stats.successfulOutings, "réussie", "réussies")} · {fmtExposure(stats.totalExposureMin)} d'expo
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-xs)" }}>
            <StatCard
              label="Ciel moyen"
              value={stats.avgScoreSuccessful != null ? stats.avgScoreSuccessful : "n/d"}
              sub="nuits réussies"
            />
            <StatCard
              label="Note"
              value={stats.avgRating != null ? `${stats.avgRating}/5` : "n/d"}
              sub={plural(stats.ratedOutings, "notée", "notées")}
            />
            <StatCard
              label={isThisYear ? "Ce mois" : "Captures"}
              value={capturesShown}
              sub={capturesShown < 2 ? "capturée" : "capturées"}
            />
          </div>
          <MonthChart stats={stats} year={year} now={now} />
          {stats.byFamily && <FamilySplit families={stats.byFamily} />}
          <NightsHeatmap past={past} year={year} />
          <MessierLine past={past} captured={captured} year={year} />
          <DurationChart past={past} year={year} />
          <HoursChart past={past} year={year} />
          {stats.outingsBySite.length > 0 && (
            <RankedBars
              title="Lieux d'observation"
              rows={stats.outingsBySite.map((s) => ({
                key: s.name,
                label: s.name,
                sub: `dernière ${shortDate(s.lastDate)}`,
                value: s.count,
                valueText: plural(s.count, "sortie", "sorties"),
              }))}
              limit={5}
            />
          )}
          {stats.exposureByTarget.length > 0 && (
            <RankedBars
              title="Expo cumulée par cible"
              rows={stats.exposureByTarget.map((e) => ({
                key: e.designation,
                label: e.designation,
                value: e.totalMin,
                valueText: fmtExposure(e.totalMin),
                onOpen: () => onOpenTarget(e.designation),
              }))}
              limit={6}
            />
          )}
        </>
      )}
    </Section>
  );
}

function shortDate(isoDate: string): string {
  return new Date(isoDate + "T00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Titre d'un graphique, et a droite un complement (reglage, total). */
function ChartHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="nc-row nc-between" style={{ minHeight: 32 }}>
      <span className="nc-caption" style={{ whiteSpace: "nowrap" }}>{title}</span>
      {children}
    </div>
  );
}

/** Ligne de lecture sous un graphique : l'infobulle, lisible au doigt. */
function Readout({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>{children}</div>;
}

interface Bar {
  key: string;
  value: number;
  /** Graduation sous la barre ; vide pour n'en marquer qu'une sur plusieurs. */
  tick: string;
  aria: string;
  /** Valeur affichee au-dessus de la barre choisie, si le nombre brut ne
   * parle pas (des minutes, par exemple). */
  valueText?: string;
}

/** Barres verticales a l'echelle de la plus haute. Un appui choisit une
 * barre, dont la valeur s'affiche au-dessus ; l'appelant en donne le detail
 * dans sa ligne de lecture. */
function BarStrip({ bars, selected, onSelect, height = 72 }: {
  bars: Bar[];
  selected: number;
  onSelect: (i: number) => void;
  height?: number;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
      <div style={{ display: "flex", gap: 2, height: height + 20, alignItems: "stretch" }}>
        {bars.map((b, i) => (
          <button
            key={b.key}
            onClick={() => onSelect(i)}
            aria-label={b.aria}
            aria-pressed={i === selected}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "stretch",
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
            }}
          >
            {b.value > 0 && i === selected && (
              <span
                className="nc-num"
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--ink)",
                  marginBottom: 2,
                  whiteSpace: "nowrap",
                  // Plus large que sa barre : calee sur le bord aux extremites
                  // pour ne pas deborder du graphique.
                  alignSelf: i === 0 ? "flex-start" : i === bars.length - 1 ? "flex-end" : "center",
                }}
              >
                {b.valueText ?? b.value}
              </span>
            )}
            <span
              style={{
                height: b.value > 0 ? `${Math.max(4, (b.value / max) * height)}px` : 2,
                borderRadius: b.value > 0 ? "4px 4px 0 0" : 0,
                background: b.value > 0 ? "var(--accent)" : "var(--line)",
                opacity: i === selected || b.value === 0 ? 1 : 0.55,
              }}
            />
          </button>
        ))}
      </div>
      <div className="nc-num" style={{ display: "flex", gap: 2, fontSize: "var(--text-xs)", color: "var(--ink3)" }}>
        {bars.map((b, i) => (
          <span
            key={b.key}
            style={{ flex: 1, minWidth: 0, textAlign: "center", overflow: "visible", whiteSpace: "nowrap", color: i === selected ? "var(--ink)" : undefined }}
          >
            {b.tick}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Sorties ou captures par mois de l'annee. */
function MonthChart({ stats, year, now }: { stats: Stats; year: number; now: Date }) {
  const [measure, setMeasure] = useState<Measure>("outings");
  const bars = monthsOfYear(stats.outingsByMonth, stats.capturesByMonth, year);
  // Le mois en cours pour l'annee en cours, sinon le dernier mois ou l'on
  // est sorti.
  const current = bars.findIndex((b) => b.month === localMonthKey(now));
  const lastActive = bars.map((b) => b.outings > 0).lastIndexOf(true);
  const [picked, setPicked] = useState<{ year: number; index: number } | null>(null);
  const selected = picked?.year === year ? picked.index : current >= 0 ? current : Math.max(0, lastActive);
  const b = bars[selected];
  return (
    <div className="nc-stack-xs">
      <ChartHead title="Par mois">
        <div className="nc-segmented" role="radiogroup" aria-label="Mesure" style={{ width: 190 }}>
          {(["outings", "captures"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={measure === m}
              onClick={() => setMeasure(m)}
              className={measure === m ? "nc-segment nc-segment-active" : "nc-segment"}
              style={{ minHeight: 32 }}
            >
              {m === "outings" ? "Sorties" : "Captures"}
            </button>
          ))}
        </div>
      </ChartHead>
      <BarStrip
        bars={bars.map((m) => ({ key: m.month, value: m[measure], tick: monthInitial(m.month), aria: `${monthLabel(m.month)} : ${m[measure]}` }))}
        selected={selected}
        onSelect={(index) => setPicked({ year, index })}
      />
      <Readout>
        {monthLabel(b.month)} : {plural(b.outings, "sortie", "sorties")} ·{" "}
        {plural(b.captures, "cible capturée", "cibles capturées")}
      </Readout>
    </div>
  );
}

const FAMILY_LABEL: Record<Family, string> = {
  galaxies: "Galaxies",
  nebuleuses: "Nébuleuses",
  amas: "Amas",
  autres: "Autres",
};
// Une seule teinte, l'accent, en quatre intensites : le mode nuit n'a que du
// rouge, et chaque famille est de toute facon nommee dans la legende.
const FAMILY_OPACITY: Record<Family, number> = { galaxies: 1, nebuleuses: 0.68, amas: 0.42, autres: 0.24 };

type FamilyMeasure = "targets" | "captured" | "exposureMin";

/** Ce que l'on observe : une barre partagee entre les familles d'objets,
 * et sous elle la legende chiffree. */
function FamilySplit({ families }: { families: FamilyCount[] }) {
  const [measure, setMeasure] = useState<FamilyMeasure>("targets");
  const total = families.reduce((sum, f) => sum + f[measure], 0);
  if (families.every((f) => f.targets === 0)) return null;
  const fmt = (v: number) => (measure === "exposureMin" ? fmtExposure(v) : String(v));
  const shown = families.filter((f) => f[measure] > 0);
  return (
    <div className="nc-stack-xs">
      <ChartHead title="Types d'objets">
        <div className="nc-segmented" role="radiogroup" aria-label="Mesure" style={{ width: 210 }}>
          {([["targets", "Cibles"], ["captured", "Capturées"], ["exposureMin", "Expo"]] as const).map(([m, label]) => (
            <button
              key={m}
              role="radio"
              aria-checked={measure === m}
              onClick={() => setMeasure(m)}
              className={measure === m ? "nc-segment nc-segment-active" : "nc-segment"}
              style={{ minHeight: 32 }}
            >
              {label}
            </button>
          ))}
        </div>
      </ChartHead>
      {total === 0 ? (
        <Readout>Rien à répartir pour l'instant.</Readout>
      ) : (
        <>
          <div
            role="img"
            aria-label={shown.map((f) => `${FAMILY_LABEL[f.family]} ${fmt(f[measure])}`).join(", ")}
            style={{ display: "flex", gap: 2, height: 14 }}
          >
            {shown.map((f, i) => (
              <span
                key={f.family}
                style={{
                  flex: f[measure],
                  minWidth: 4,
                  background: "var(--accent)",
                  opacity: FAMILY_OPACITY[f.family],
                  borderRadius: `${i === 0 ? 4 : 0}px ${i === shown.length - 1 ? 4 : 0}px ${i === shown.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px`,
                }}
              />
            ))}
          </div>
          <div className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
            {families.map((f) => (
              <div key={f.family} className="nc-row" style={{ gap: 6, fontSize: "var(--text-sm)", minWidth: 0 }}>
                <span
                  className="nc-none"
                  style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)", opacity: FAMILY_OPACITY[f.family] }}
                />
                <span className="nc-grow nc-ellipsis">{FAMILY_LABEL[f.family]}</span>
                <span className="nc-num nc-none" style={{ color: "var(--ink2)" }}>
                  {fmt(f[measure])}
                </span>
                <span className="nc-num nc-none" style={{ color: "var(--ink3)", width: "4ch", textAlign: "right" }}>
                  {Math.round((f[measure] / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Opacite d'une case selon la note, 1 a 5 : une seule teinte, de clair a
 * franc, comme toute echelle de grandeur. */
function ratingOpacity(rating: number): number {
  return 0.3 + ((rating - 1) / 4) * 0.7;
}

/** Les nuits de l'annee : une ligne par mois, une case par jour. Une case
 * pleine est une sortie, d'autant plus franche qu'elle a ete bien notee ;
 * une case cerclee, une sortie sans note. */
function NightsHeatmap({ past, year }: { past: PastSession[]; year: number }) {
  const grid = yearGrid(past, year);
  const [picked, setPicked] = useState<string | null>(null);
  const outings = grid.flat().filter((c) => c.outing);
  const cell = (picked && outings.find((c) => c.date === picked)) || outings[outings.length - 1];
  if (!cell) return null;
  const o = cell.outing!;
  return (
    <div className="nc-stack-xs">
      <ChartHead title="Nuits de l'année">
        <span className="nc-row nc-none" style={{ gap: 3, fontSize: "var(--text-xs)", color: "var(--ink3)" }}>
          note 1
          {[1, 2, 3, 4, 5].map((r) => (
            <span key={r} style={{ width: 9, height: 9, borderRadius: 2, background: "var(--accent)", opacity: ratingOpacity(r) }} />
          ))}
          5
          <span style={{ width: 9, height: 9, borderRadius: 2, border: "1.5px solid var(--accent)", marginLeft: 6, boxSizing: "border-box" }} />
          sans
        </span>
      </ChartHead>
      <div className="nc-stack-xs" style={{ gap: 2 }}>
        {grid.map((days, m) => (
          <div key={m} style={{ display: "grid", gridTemplateColumns: "14px repeat(31, minmax(0, 1fr))", gap: 2, alignItems: "center" }}>
            <span className="nc-num" style={{ fontSize: 10, color: "var(--ink3)", lineHeight: 1 }}>
              {monthInitial(days[0].date.slice(0, 7))}
            </span>
            {days.map((c) => {
              const rating = c.outing?.feeling?.rating ?? null;
              const isPicked = c.date === cell.date;
              const style: CSSProperties = {
                aspectRatio: "1",
                borderRadius: 2,
                padding: 0,
                boxSizing: "border-box",
                border: "none",
                background: "var(--line)",
                opacity: 1,
              };
              if (c.outing && rating != null) {
                style.background = "var(--accent)";
                style.opacity = ratingOpacity(rating);
              } else if (c.outing) {
                style.background = "transparent";
                style.border = "1.5px solid var(--accent)";
              }
              if (isPicked) style.outline = "1.5px solid var(--ink)";
              return c.outing ? (
                <button
                  key={c.date}
                  onClick={() => setPicked(c.date)}
                  aria-label={`${shortDate(c.date)}${rating != null ? ` : ${rating}/5` : ""}`}
                  aria-pressed={isPicked}
                  style={{ ...style, cursor: "pointer" }}
                />
              ) : (
                <span key={c.date} style={style} />
              );
            })}
          </div>
        ))}
      </div>
      <Readout>
        {shortDate(o.date)}
        {o.site?.name ? ` : ${o.site.name}` : ""}
        {o.feeling?.rating != null ? ` · ${o.feeling.rating}/5` : " · sans note"}
      </Readout>
    </div>
  );
}

/** Messier captures au fil de l'annee : une marche par nouvel objet, en
 * repartant du total atteint au 1er janvier. */
function MessierLine({ past, captured, year }: { past: PastSession[]; captured: string[]; year: number }) {
  const { before, captures, undated, total } = messierProgress(past, captured, year);
  const [picked, setPicked] = useState<{ year: number; index: number } | null>(null);
  if (captures.length === 0 && before === 0) return null;
  const W = 320;
  const H = 96;
  const pad = { l: 4, r: 4, t: 10, b: 4 };
  const startOfYear = new Date(year, 0, 1).getTime();
  const span = new Date(year + 1, 0, 1).getTime() - startOfYear;
  const now = Date.now();
  // Jusqu'a aujourd'hui pour l'annee en cours, jusqu'au 31 decembre sinon.
  const endFrac = Math.min(1, Math.max(0, (now - startOfYear) / span));
  const xOf = (date: string) => pad.l + ((new Date(date + "T12:00").getTime() - startOfYear) / span) * (W - pad.l - pad.r);
  const end = before + captures.length;
  const yMax = Math.max(10, Math.ceil(end / 10) * 10);
  const yOf = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  let d = `M ${pad.l} ${yOf(before)}`;
  captures.forEach((c, i) => {
    d += ` H ${xOf(c.date)} V ${yOf(before + i + 1)}`;
  });
  d += ` H ${pad.l + endFrac * (W - pad.l - pad.r)}`;
  const sel = captures.length ? captures[picked?.year === year ? picked.index : captures.length - 1] : null;
  return (
    <div className="nc-stack-xs">
      <ChartHead title="Messier capturés">
        <span className="nc-num" style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>
          {total}/110
        </span>
      </ChartHead>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }} role="img" aria-label={`Messier capturés en ${year} : de ${before} à ${end}`}>
        <line x1={pad.l} x2={W - pad.r} y1={yOf(0)} y2={yOf(0)} stroke="var(--line)" />
        <line x1={pad.l} x2={W - pad.r} y1={yOf(yMax)} y2={yOf(yMax)} stroke="var(--line)" strokeDasharray="2 3" />
        <text x={W - pad.r} y={yOf(yMax) - 3} textAnchor="end" fontSize="10" fill="var(--ink3)" className="nc-num">
          {yMax}
        </text>
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
        {captures.map((c, i) => {
          const isSel = sel === c;
          return (
            <g key={c.designation} onClick={() => setPicked({ year, index: i })} style={{ cursor: "pointer" }}>
              <circle cx={xOf(c.date)} cy={yOf(before + i + 1)} r={12} fill="transparent" />
              <circle
                cx={xOf(c.date)}
                cy={yOf(before + i + 1)}
                r={isSel ? 4.5 : 3}
                fill="var(--accent)"
                stroke="var(--surf)"
                strokeWidth={2}
              />
            </g>
          );
        })}
      </svg>
      <div className="nc-num" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink3)" }}>
        <span>janv.</span>
        <span>juil.</span>
        <span>déc.</span>
      </div>
      <Readout>
        {sel
          ? `${shortDate(sel.date)} : ${sel.designation}, ${sel.rank}e Messier · ${plural(captures.length, "nouveau", "nouveaux")} en ${year}`
          : `Aucun nouveau Messier en ${year}`}
        {undated > 0 && (
          <span style={{ color: "var(--ink3)" }}>
            {" "}· {plural(undated, "coché", "cochés")} hors journal, sans date
          </span>
        )}
      </Readout>
    </div>
  );
}

/** Duree de chaque sortie, dans l'ordre des nuits. */
function DurationChart({ past, year }: { past: PastSession[]; year: number }) {
  const durations = outingDurations(past, year);
  const [picked, setPicked] = useState<{ year: number; index: number } | null>(null);
  if (durations.length === 0) return null;
  const selected = picked?.year === year ? picked.index : durations.length - 1;
  const s = durations[selected];
  const avg = Math.round(durations.reduce((sum, x) => sum + x.minutes, 0) / durations.length);
  // Une graduation au changement de mois, pas a chaque barre.
  const bars = durations.map((x, i) => ({
    key: `${x.date}-${i}`,
    value: x.minutes,
    tick: i === 0 || durations[i - 1].date.slice(0, 7) !== x.date.slice(0, 7) ? monthInitial(x.date.slice(0, 7)) : "",
    aria: `${shortDate(x.date)} : ${fmtExposure(x.minutes)}`,
    valueText: fmtExposure(x.minutes),
  }));
  return (
    <div className="nc-stack-xs">
      <ChartHead title="Durée des sorties">
        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink3)" }}>
          moyenne <span className="nc-num" style={{ color: "var(--ink2)" }}>{fmtExposure(avg)}</span>
        </span>
      </ChartHead>
      <BarStrip
        bars={bars}
        selected={selected}
        onSelect={(index) => setPicked({ year, index })}
        height={60}
      />
      <Readout>
        {shortDate(s.date)} : {fmtExposure(s.minutes)}, de l'ouverture à la dernière saisie
      </Readout>
    </div>
  );
}

/** Heures des notes, de midi a midi. */
function HoursChart({ past, year }: { past: PastSession[]; year: number }) {
  const hours = notesByHour(past, year);
  const total = hours.reduce((sum, h) => sum + h.count, 0);
  const peak = hours.reduce((best, h, i) => (h.count > hours[best].count ? i : best), 0);
  const [picked, setPicked] = useState<number | null>(null);
  if (total === 0) return null;
  const selected = picked ?? peak;
  const h = hours[selected];
  return (
    <div className="nc-stack-xs">
      <ChartHead title="Heures d'observation" />
      <BarStrip
        bars={hours.map((x) => ({
          key: String(x.hour),
          value: x.count,
          tick: x.hour % 6 === 0 ? `${x.hour}h` : "",
          aria: `${x.hour} h : ${x.count}`,
        }))}
        selected={selected}
        onSelect={setPicked}
        height={52}
      />
      <Readout>
        {h.hour} h – {(h.hour + 1) % 24} h : {plural(h.count, "note", "notes")}
        {selected === peak ? ", l'heure la plus active" : ""}
      </Readout>
    </div>
  );
}

interface RankedRow {
  key: string;
  label: string;
  sub?: string;
  value: number;
  valueText: string;
  onOpen?: () => void;
}

/** Classement en barres fines, a l'echelle du premier. Au-dela de `limit`,
 * « Tout voir » deplie le reste plutot que de le taire. */
function RankedBars({ title, rows, limit }: { title: string; rows: RankedRow[]; limit: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const hidden = rows.length - limit;
  return (
    <div className="nc-stack-xs">
      <div className="nc-caption">{title}</div>
      {shown.map((r) => (
        <div key={r.key} className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
          <div className="nc-row nc-between" style={{ fontSize: "var(--text-sm)" }}>
            {r.onOpen ? (
              <button
                onClick={r.onOpen}
                className="nc-link nc-num nc-ellipsis"
                style={{ minHeight: 0, fontSize: "var(--text-sm)", color: "var(--ink)", fontWeight: 500 }}
              >
                {r.label}
              </button>
            ) : (
              <span className="nc-ellipsis">
                {r.label}
                {r.sub && <span style={{ color: "var(--ink3)", fontSize: "var(--text-xs)" }}> · {r.sub}</span>}
              </span>
            )}
            <span className="nc-num nc-none" style={{ color: "var(--ink2)" }}>{r.valueText}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "var(--line)" }}>
            <div
              style={{ width: `${(r.value / max) * 100}%`, height: "100%", borderRadius: 2, background: "var(--accent)" }}
            />
          </div>
        </div>
      ))}
      {hidden > 0 && (
        <button onClick={() => setAll((v) => !v)} className="nc-link nc-link-accent">
          {all ? "Réduire" : `Tout voir (+${hidden})`}
        </button>
      )}
    </div>
  );
}
