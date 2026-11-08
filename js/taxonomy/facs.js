/*
 * FACS recipes -> this model's muscles.
 *
 * A recipe is written the way FACS coders write it: action units joined by "+", each with an
 * optional intensity letter (A trace .. E maximum) and an optional side prefix (R/L, subject's
 * own side), e.g. "1C+4B+15C+17B+54A+64B" or "R12A+R14C". Head (51-58) and eye (61-64) codes
 * become head pose and gaze instead of muscles.
 */

// FACS intensity letters -> weight.
const LEVEL = { A: 0.2, B: 0.4, C: 0.6, D: 0.8, E: 1 };

/** What each action unit is, in Romanian, and which of the model's blendshapes produce it. */
export const AU = {
  1: { name: 'Ridicarea interioară a sprâncenelor', muscle: 'frontal (medial)', shapes: ['browInnerUp'] },
  2: { name: 'Ridicarea exterioară a sprâncenelor', muscle: 'frontal (lateral)', shapes: ['browOuterUp*'] },
  4: { name: 'Coborârea și apropierea sprâncenelor', muscle: 'corugator, procer', shapes: ['browDown*'] },
  5: { name: 'Ridicarea pleoapei superioare', muscle: 'ridicătorul pleoapei (n. III)', shapes: ['eyeWide*'] },
  6: { name: 'Ridicarea obrajilor', muscle: 'orbicularul ochiului (orbitar)', shapes: ['cheekSquint*'] },
  7: { name: 'Încordarea pleoapelor', muscle: 'orbicularul ochiului (palpebral)', shapes: ['eyeSquint*'] },
  9: { name: 'Încrețirea nasului', muscle: 'ridicătorul buzei și aripii nasului', shapes: ['noseSneer*'] },
  10: { name: 'Ridicarea buzei superioare', muscle: 'ridicătorul buzei superioare', shapes: ['mouthUpperUp*'] },
  12: { name: 'Tragerea colțurilor gurii în sus', muscle: 'zigomatic mare', shapes: ['mouthSmile*'] },
  14: { name: 'Gropiță (colțuri trase înapoi)', muscle: 'buccinator', shapes: ['mouthDimple*'] },
  15: { name: 'Coborârea colțurilor gurii', muscle: 'coborâtorul unghiului gurii', shapes: ['mouthFrown*'] },
  16: { name: 'Coborârea buzei inferioare', muscle: 'coborâtorul buzei inferioare', shapes: ['mouthLowerDown*'] },
  17: { name: 'Ridicarea bărbiei', muscle: 'mentonier', shapes: ['mouthShrugLower'] },
  18: { name: 'Țuguierea buzelor', muscle: 'orbicularul gurii', shapes: ['mouthPucker'] },
  20: { name: 'Întinderea laterală a buzelor', muscle: 'risorius, platisma', shapes: ['mouthStretch*'] },
  22: { name: 'Buze în pâlnie', muscle: 'orbicularul gurii', shapes: ['mouthFunnel'] },
  23: { name: 'Strângerea buzelor', muscle: 'orbicularul gurii', shapes: ['mouthPress*:0.6', 'mouthRollLower:0.3'] },
  24: { name: 'Presarea buzelor', muscle: 'orbicularul gurii', shapes: ['mouthPress*'] },
  25: { name: 'Buze întredeschise', muscle: 'relaxare / coborâtorii buzei', shapes: ['jawOpen:0.12'] },
  26: { name: 'Maxilar coborât', muscle: 'pterigoidian, digastric (n. V3)', shapes: ['jawOpen:0.4'] },
  27: { name: 'Gura larg deschisă', muscle: 'pterigoidian, digastric (n. V3)', shapes: ['jawOpen:0.85'] },
  28: { name: 'Rularea buzelor spre interior', muscle: 'orbicularul gurii', shapes: ['mouthRollLower', 'mouthRollUpper'] },
  41: { name: 'Pleoapă căzută', muscle: 'relaxarea ridicătorului pleoapei', shapes: ['eyeBlink*:0.35'] },
  43: { name: 'Ochi închiși / pleoape grele', muscle: 'relaxarea ridicătorului pleoapei', shapes: ['eyeBlink*:0.7'] },
  45: { name: 'Clipit', muscle: 'orbicularul ochiului', shapes: ['eyeBlink*'] },
  51: { name: 'Capul întors la stânga', head: { yaw: 20 } },
  52: { name: 'Capul întors la dreapta', head: { yaw: -20 } },
  53: { name: 'Capul ridicat', head: { pitch: -18 } },
  54: { name: 'Capul plecat', head: { pitch: 18 } },
  55: { name: 'Capul înclinat la stânga', head: { roll: -15 } },
  56: { name: 'Capul înclinat la dreapta', head: { roll: 15 } },
  61: { name: 'Privirea la stânga', gaze: [0.35, 0] },
  62: { name: 'Privirea la dreapta', gaze: [-0.35, 0] },
  63: { name: 'Privirea în sus', gaze: [0, -0.3] },
  64: { name: 'Privirea în jos', gaze: [0, 0.3] },
};

/** Split a recipe into its terms: [{ au, level, side }]. */
export function parseRecipe(recipe) {
  if (!recipe) return [];
  return recipe.split('+').map((t) => t.trim()).filter(Boolean).map((t) => {
    const m = /^([RL]?)(\d+)([A-E]?)$/.exec(t);
    if (!m) throw new Error(`FACS: termen invalid "${t}"`);
    return { side: m[1] || null, au: Number(m[2]), level: m[3] || 'C' };
  });
}

/**
 * Recipe -> expression for the studio: { w (blendshape weights), head (degrees), gaze }.
 * Unilateral terms drive one side only; bilateral ones both, at the same weight.
 */
export function recipeToExpression(recipe) {
  const w = {};
  const head = { pitch: 0, yaw: 0, roll: 0 };
  const gaze = [0, 0];
  for (const { au, level, side } of parseRecipe(recipe)) {
    const def = AU[au];
    if (!def) continue;
    const k = LEVEL[level] ?? 0.6;
    if (def.head) for (const [a, v] of Object.entries(def.head)) head[a] += v * k;
    if (def.gaze) { gaze[0] += def.gaze[0] * k; gaze[1] += def.gaze[1] * k; }
    for (const s of def.shapes ?? []) {
      const [name, gain] = s.split(':');
      const g = gain ? Number(gain) : 1;
      const names = name.endsWith('*')
        ? (side === 'R' ? [name.slice(0, -1) + 'Right'] : side === 'L' ? [name.slice(0, -1) + 'Left'] : [name.slice(0, -1) + 'Left', name.slice(0, -1) + 'Right'])
        : [name];
      for (const n of names) w[n] = Math.min(1, Math.max(w[n] ?? 0, k * g));
    }
  }
  return { w, head, gaze };
}

/** Action units a recipe uses, for display: [{ au, level, side, name }]. */
export function describeRecipe(recipe) {
  return parseRecipe(recipe).map((t) => ({ ...t, name: AU[t.au]?.name ?? `AU${t.au}` }));
}
