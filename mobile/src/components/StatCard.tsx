import type { ReactNode } from "react";

/** Une mesure de la nuit : temperature, illumination lunaire, rafales, buee.
 *
 * La valeur est le plus souvent un nombre, et passe alors en chasse fixe
 * comme le reste des chiffres. Elle est parfois un mot ("Faible" pour le
 * risque de buee) : le monospace donnait a ce mot-la l'allure d'un code, et
 * `valueIsWord` le rend a la police de texte. */
export function StatCard({
  label,
  value,
  sub,
  valueIsWord,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  valueIsWord?: boolean;
}) {
  return (
    <div className="nc-card" style={{ padding: "13px 12px", borderRadius: 15 }}>
      {/* Meme nature que les intitules de section, donc meme habillage. */}
      <div className="nc-eyebrow">{label}</div>
      <div
        className={valueIsWord ? undefined : "nc-num"}
        style={{ fontSize: "var(--text-lg)", fontWeight: valueIsWord ? 600 : 500, marginTop: "var(--space-xs)" }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink2)", marginTop: "var(--space-2xs)" }}>{sub}</div>
      )}
    </div>
  );
}
