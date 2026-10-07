import type { LegendDetail } from "./legends.ts";
import { DETAILS_A } from "./legendsDetailsA.ts";
import { DETAILS_B } from "./legendsDetailsB.ts";
import { DETAILS_C } from "./legendsDetailsC.ts";
import { DETAILS_D } from "./legendsDetailsD.ts";
import { DETAILS_E } from "./legendsDetailsE.ts";
import { DETAILS_F } from "./legendsDetailsF.ts";
import { DETAILS_MODELS } from "./legendsDetailsModels.ts";

/** Tous les developpements historiques, par identifiant de constellation. */
export const DETAILS: Record<string, LegendDetail[]> = {
  ...DETAILS_MODELS,
  ...DETAILS_A,
  ...DETAILS_B,
  ...DETAILS_C,
  ...DETAILS_D,
  ...DETAILS_E,
  ...DETAILS_F,
};
