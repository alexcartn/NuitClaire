import type { TargetRow as TargetRowT } from "../types";

/** Une cible dans la liste "Cibles" / resultats de recherche.
 *
 * La ligne de chiffres (creneau, altitude, separation lunaire) est ce qui
 * decide si on pointe cet objet ce soir : elle passe donc devant le type et
 * le cadrage, et les valeurs y sont lisibles quand les mots qui les
 * qualifient s'effacent. Elle etait auparavant dans la couleur la plus
 * eteinte de la palette, sous un nom deux fois plus gros -- l'inverse de ce
 * que l'oeil doit trouver en premier.
 *
 * Le type et le cadrage sont deux natures d'information differentes (ce
 * qu'est l'objet, et comment il rentre dans le champ) : ils ne portent plus
 * le meme habillage. */
export function TargetRowCard({
  row,
  isNew,
  onOpen,
}: {
  row: TargetRowT;
  isNew?: boolean;
  onOpen: () => void;
}) {
  const subtitleParts = [row.commonName, row.ngc && row.ngc !== row.designation ? row.ngc : null].filter(
    Boolean,
  );
  const feasible = Boolean(row.start && row.end);
  return (
    <button
      onClick={onOpen}
      className="nc-card"
      style={{
        width: "100%",
        textAlign: "left",
        display: "flex",
        gap: "var(--space-sm)",
        cursor: "pointer",
        color: "var(--ink)",
      }}
    >
      <div
        className="nc-strip"
        style={{
          width: 78, height: 78, flex: "none", borderRadius: 11,
          background: "var(--surf2)", overflow: "hidden",
        }}
      >
        {row.imageUrl && (
          <img
            src={row.imageUrl}
            alt=""
            loading="lazy"
            // Une vignette qui ne charge pas laisse la place a l'aplat, pas a
            // l'icone d'image cassee du navigateur : le CDS est parfois lent
            // ou injoignable, et la liste doit rester presentable.
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-2xs)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)" }}>
          <span className="nc-num" style={{ fontSize: "var(--text-md)", fontWeight: 500 }}>
            {row.designation}
          </span>
          {isNew && (
            // Raison du tri : cette cible est un Messier qui manque encore au
            // catalogue. C'est ce qui la place en tete de liste, autant que ca
            // se lise.
            <span
              className="nc-num"
              style={{
                fontSize: "var(--text-xs)",
                letterSpacing: ".06em",
                padding: "3px 7px",
                borderRadius: 5,
                background: "var(--accent)",
                color: "var(--onaccent)",
              }}
            >
              À FAIRE
            </span>
          )}
        </div>

        {/* Le creneau porte la decision, les deux angles la nuancent : deux
            tailles sur la meme ligne, alignees sur la ligne de base, pour
            que l'oeil prenne l'heure d'abord sans que la ligne reparte a la
            ligne. */}
        <div
          className="nc-num"
          style={{
            display: "flex", alignItems: "baseline",
            // Assez d'ecart pour separer les deux groupes sans ponctuation :
            // le point median qui les separait avant se retrouvait orphelin
            // en tete de ligne des que la ligne cassait.
            gap: "var(--space-xs)",
            // Et elle casse : a 390 px de large, le creneau et les deux
            // angles demandent 240 px pour 230 disponibles. C'est entre les
            // deux groupes que la coupure doit tomber -- « 20:00– / 04:00 »
            // coupe en deux une seule valeur, et ne se lit plus. Sur un
            // ecran plus large, tout revient sur une ligne.
            flexWrap: "wrap",
          }}
        >
          {feasible ? (
            <>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--ink)", whiteSpace: "nowrap" }}>
                {row.start}–{row.end}
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink3)", whiteSpace: "nowrap" }}>
                alt <span style={{ color: "var(--ink2)" }}>{Math.round(row.altMaxDeg)}°</span>
                {" · lune "}
                <span style={{ color: "var(--ink2)" }}>{Math.round(row.moonSepDeg)}°</span>
              </span>
            </>
          ) : (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--ink3)" }}>infaisable ce soir</span>
          )}
        </div>

        {subtitleParts.length > 0 && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--ink2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitleParts.join(" · ")}
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--space-2xs)", flexWrap: "wrap", alignItems: "center" }}>
          <span
            style={{
              fontSize: "var(--text-xs)", color: "var(--ink2)", padding: "3px 8px",
              borderRadius: 5, background: "var(--surf2)",
            }}
          >
            {row.type}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink3)" }}>
            {row.cadrage}
          </span>
        </div>
      </div>
    </button>
  );
}
