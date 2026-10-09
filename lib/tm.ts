"use client";
import { MODEL_BASE } from "./config";

// Minimal typing for the Teachable Machine browser build (served from /vendor).
export interface TMModel {
  predict(input: HTMLImageElement | HTMLCanvasElement, flipped?: boolean): Promise<{ className: string; probability: number }[]>;
  getClassLabels(): string[];
}
interface TMImageGlobal {
  load(modelURL: string, metadataURL: string): Promise<TMModel>;
  loadFromFiles(model: File, weights: File, metadata: File): Promise<TMModel>;
}
declare global { interface Window { tmImage?: TMImageGlobal; tf?: unknown } }

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.async = false; s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Nuk u ngarkua ${src}`));
    document.head.appendChild(s);
  });
}

let libPromise: Promise<TMImageGlobal> | null = null;
export function loadLibraries(): Promise<TMImageGlobal> {
  if (!libPromise) {
    libPromise = (async () => {
      await loadScript("/vendor/tf.min.js");
      await loadScript("/vendor/teachablemachine-image.min.js");
      if (!window.tmImage) throw new Error("Libraria Teachable Machine mungon");
      return window.tmImage;
    })();
    libPromise.catch(() => { libPromise = null; });
  }
  return libPromise;
}

export async function loadBundledModel(): Promise<TMModel> {
  const tm = await loadLibraries();
  return tm.load(MODEL_BASE + "model.json", MODEL_BASE + "metadata.json");
}

export async function loadModelFromFiles(files: File[]): Promise<TMModel> {
  const tm = await loadLibraries();
  const find = (re: RegExp) => files.find((f) => re.test(f.name));
  const model = find(/^model.*\.json$/i), weights = find(/\.bin$/i), metadata = find(/^metadata.*\.json$/i);
  if (!model || !weights || !metadata) throw new Error("Zgjidhni të tre skedarët: model.json, weights.bin dhe metadata.json.");
  return tm.loadFromFiles(model, weights, metadata);
}
