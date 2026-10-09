import { BIOMARKERS, Biomarker, BiomarkerKey, RISK_BANDS, VISUAL_CLASS_RISK, WEIGHTS } from "./config";

export type Level = 0 | 1 | 2;
export const LEVEL_LABEL: Record<Level, string> = { 0: "Normal", 1: "I rritur", 2: "I lartë" };

export interface BiomarkerResult {
  marker: Biomarker;
  value: number;
  level: Level;
  belowNormal: boolean;
}

export interface Prediction { className: string; probability: number }

export interface Analysis {
  visual: { predictions: Prediction[]; topIndex: number; score: number };
  chemical: { results: BiomarkerResult[]; score: number };
  fused: number;
  band: (typeof RISK_BANDS)[number];
  conflict: boolean;
}

export function biomarkerLevel(m: Biomarker, value: number): Level {
  if (value > m.highAbove) return 2;
  if (value > m.normalMax) return 1;
  return 0;
}

export function chemicalScore(values: Record<BiomarkerKey, number>) {
  const results: BiomarkerResult[] = BIOMARKERS.map((m) => {
    const value = values[m.key];
    return { marker: m, value, level: biomarkerLevel(m, value), belowNormal: value < m.normalMin };
  });
  const score = results.reduce((s, r) => s + r.level / 2, 0) / results.length;
  return { results, score };
}

export function visualScore(predictions: Prediction[]) {
  const probs = predictions.map((p) => p.probability);
  const topIndex = probs.indexOf(Math.max(...probs));
  const score = probs.reduce((s, p, i) => s + p * (VISUAL_CLASS_RISK[i] ?? 0), 0);
  return { predictions, topIndex, score: Math.min(1, Math.max(0, score)) };
}

export function analyse(predictions: Prediction[], values: Record<BiomarkerKey, number>): Analysis {
  const visual = visualScore(predictions);
  const chemical = chemicalScore(values);
  const fused = WEIGHTS.visual * visual.score + WEIGHTS.chemical * chemical.score;
  const band = RISK_BANDS.find((b) => fused < b.upTo) ?? RISK_BANDS[RISK_BANDS.length - 1];
  // The two modules disagree strongly: worth saying so instead of hiding it in the average.
  const conflict = Math.abs(visual.score - chemical.score) >= 0.5;
  return { visual, chemical, fused, band, conflict };
}

/** "2. OPMD (Rrezik i Mesëm)" → { name: "OPMD", note: "Rrezik i Mesëm" } */
export function parseLabel(raw: string) {
  const s = String(raw).trim().replace(/^\d+\.\s*/, "");
  const m = s.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { name: m[1], note: m[2] } : { name: s, note: "" };
}
