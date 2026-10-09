// ---------------------------------------------------------------------------
// OralScan AI – study configuration.
// Every clinical number the app uses lives in this file, so it can be adjusted
// to match the study's Excel sheet without touching the interface code.
// ---------------------------------------------------------------------------

/** Weight of each module in the fused risk index (must add up to 1). */
export const WEIGHTS = { visual: 0.4, chemical: 0.6 } as const;

/**
 * Risk weight of each visual class, in the order of the model's labels:
 * 0. Normale, 1. Benigne, 2. OPMD, 3. Maligne.
 * Visual score = Σ probability(class) × weight(class), giving a value from 0 to 1.
 */
export const VISUAL_CLASS_RISK = [0, 1 / 3, 2 / 3, 1];

export type BiomarkerKey = "il6" | "il8" | "tnf" | "mmp9";

export interface Biomarker {
  key: BiomarkerKey;
  label: string;
  unit: string;
  /** Normal salivary range shown to the user. */
  normalMin: number;
  normalMax: number;
  /** Upper end of the OPMD range in the study table (shown to the user). */
  opmdMax: number;
  /** Values above this count as high risk / OSCC (level 2). Above normalMax up to this is level 1 (OPMD). */
  highAbove: number;
  /** Value prefilled in the form. */
  defaultValue: number;
  role: string;
}

/**
 * Cut-off values for the three risk levels, from the study table:
 * healthy/benign (low risk) ≤ normalMax, OPMD (medium) up to highAbove, OSCC (high) > highAbove.
 * Values in the gap between the OPMD range and the OSCC cut-off still count as level 1.
 */
export const BIOMARKERS: Biomarker[] = [
  { key: "il6", label: "IL-6", unit: "pg/mL", normalMin: 0, normalMax: 5, opmdMax: 15, highAbove: 15, defaultValue: 0, role: "Citokinë proinflamatore" },
  { key: "il8", label: "IL-8", unit: "pg/mL", normalMin: 100, normalMax: 250, opmdMax: 500, highAbove: 600, defaultValue: 100, role: "Kemokinë, angiogjenezë" },
  { key: "tnf", label: "TNF-α", unit: "pg/mL", normalMin: 0, normalMax: 3, opmdMax: 8, highAbove: 10, defaultValue: 0, role: "Citokinë proinflamatore" },
  { key: "mmp9", label: "MMP-9", unit: "ng/mL", normalMin: 10, normalMax: 100, opmdMax: 205, highAbove: 214, defaultValue: 10, role: "Degradim i matriksit, invazivitet" },
];

/** Fused index bands → final risk category. */
export const RISK_BANDS = [
  { upTo: 0.33, key: "low", label: "Rrezik i ulët", advice: "Ndjekje klinike rutinë dhe rikontroll periodik." },
  { upTo: 0.66, key: "mid", label: "Rrezik i mesëm", advice: "Monitorim i ngushtë; konsideroni biopsi nëse lezioni nuk regredon brenda 2 javësh." },
  { upTo: Infinity, key: "high", label: "Rrezik i lartë", advice: "Referim i shpejtë te kirurgu maksilofacial dhe biopsi." },
] as const;

/** Where the app loads the Teachable Machine model from (served by this app). */
export const MODEL_BASE = "/model/";
