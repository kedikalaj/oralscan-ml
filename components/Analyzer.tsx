"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BIOMARKERS, BiomarkerKey, RISK_BANDS, WEIGHTS } from "@/lib/config";
import { analyse, Analysis, biomarkerLevel, LEVEL_LABEL, parseLabel } from "@/lib/scoring";
import { loadBundledModel, loadModelFromFiles, TMModel } from "@/lib/tm";

type ModelState = { status: "loading" } | { status: "ready"; labels: string[] } | { status: "error"; message: string };

const LEVEL_TONE = ["ok", "warn", "bad"] as const;
const BAND_TONE: Record<string, string> = { low: "ok", mid: "warn", high: "bad" };

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const initialValues = () =>
  Object.fromEntries(BIOMARKERS.map((m) => [m.key, String(m.defaultValue)])) as Record<BiomarkerKey, string>;

export default function Analyzer() {
  const modelRef = useRef<TMModel | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [model, setModel] = useState<ModelState>({ status: "loading" });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageError, setImageError] = useState("");
  const [values, setValues] = useState<Record<BiomarkerKey, string>>(initialValues);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [resultAt, setResultAt] = useState<Date | null>(null);
  const [runError, setRunError] = useState("");
  const [over, setOver] = useState(false);

  useEffect(() => {
    let alive = true;
    loadBundledModel()
      .then((m) => { if (!alive) return; modelRef.current = m; setModel({ status: "ready", labels: m.getClassLabels() }); })
      .catch(() => alive && setModel({ status: "error", message: "Modeli nuk u gjet në server (public/model)." }));
    return () => { alive = false; };
  }, []);

  const onModelFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setModel({ status: "loading" });
    try {
      const m = await loadModelFromFiles(Array.from(files));
      modelRef.current = m; setModel({ status: "ready", labels: m.getClassLabels() });
    } catch (e) {
      setModel({ status: "error", message: e instanceof Error ? e.message : "Skedarët e modelit nuk u lexuan." });
    }
  };

  const takeImage = useCallback((file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setImageError("Skedari nuk është imazh. Zgjidhni një foto JPG ose PNG."); return; }
    setImageError(""); setResult(null);
    setImageUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
    setImageName(file.name || "foto e ngjitur");
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (item) takeImage(item.getAsFile());
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [takeImage]);

  const parsed = useMemo(() => {
    const out = {} as Record<BiomarkerKey, number>;
    const errors: Partial<Record<BiomarkerKey, string>> = {};
    for (const m of BIOMARKERS) {
      const raw = values[m.key].trim().replace(",", ".");
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n)) errors[m.key] = "Shkruani një numër";
      else if (n < 0) errors[m.key] = "Vlera nuk mund të jetë negative";
      else out[m.key] = n;
    }
    return { values: out, errors };
  }, [values]);

  const formOk = Object.keys(parsed.errors).length === 0;
  const canRun = model.status === "ready" && !!imageUrl && formOk && !busy;
  const missing = [
    model.status !== "ready" && "modeli",
    !imageUrl && "fotografia",
    !formOk && "vlerat e biomarkerëve",
  ].filter(Boolean) as string[];

  const process = async () => {
    if (!canRun || !modelRef.current || !imgRef.current) return;
    setBusy(true); setRunError("");
    try {
      if (!imgRef.current.complete) await new Promise((r) => imgRef.current!.addEventListener("load", r, { once: true }));
      const predictions = await modelRef.current.predict(imgRef.current, false);
      setResult(analyse(predictions, parsed.values));
      setResultAt(new Date());
      // Make sure the verdict banner is fully on screen; scrolls only when it is not.
      requestAnimationFrame(() => {
        const el = document.getElementById("verdict");
        if (el && el.getBoundingClientRect().bottom > window.innerHeight) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      setRunError("Analiza dështoi. Ngarkoni sërish fotografinë.");
    } finally { setBusy(false); }
  };

  const reset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null); setImageName(""); setResult(null); setResultAt(null); setValues(initialValues());
    if (fileRef.current) fileRef.current.value = "";
  };

  const labels = model.status === "ready" ? model.labels : [];

  return (
    <div className="app">
      <header className="bar">
        <div className="bar-in">
          <div className="brand">
            <span className="name">OralScan</span>
            <span className="tagline">Vlerësim i rrezikut për lezionet orale</span>
          </div>
          <div className="bar-right">
            <span className="status" data-state={model.status} role="status" aria-live="polite">
              {model.status === "loading" && "Modeli po ngarkohet…"}
              {model.status === "ready" && "Modeli gati"}
              {model.status === "error" && "Modeli mungon"}
            </span>
            <button type="button" onClick={reset} disabled={!imageUrl && !result}>Pacient i ri</button>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="panel" aria-labelledby="t-img">
          <div className="panel-head">
            <h2 id="t-img">Fotografia intraorale</h2>
            {imageUrl && <button type="button" className="link" onClick={() => fileRef.current?.click()}>Ndrysho</button>}
          </div>
          <div className="panel-body img-body">
            <div
              className={`viewer${imageUrl ? " has-img" : ""}${over ? " over" : ""}`}
              tabIndex={imageUrl ? -1 : 0} role={imageUrl ? undefined : "button"} aria-label={imageUrl ? undefined : "Zgjidh fotografinë"}
              onClick={() => !imageUrl && fileRef.current?.click()}
              onKeyDown={(e) => { if (!imageUrl && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileRef.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); takeImage(e.dataTransfer.files[0]); }}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img ref={imgRef} src={imageUrl} alt="Fotografia intraorale e ngarkuar" />
              ) : (
                <div className="empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                  <strong>Tërhiqni fotografinë këtu ose klikoni për ta zgjedhur</strong>
                  <small>JPG ose PNG · mund ta ngjisni edhe me Ctrl+V</small>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => takeImage(e.target.files?.[0])} />
            {imageName && <p className="filename" title={imageName}>{imageName}</p>}
            {imageError && <p className="err">{imageError}</p>}

            {model.status === "error" && (
              <div className="manual">
                <p><b>{model.message}</b> Në server ekzekutoni <code>npm run fetch-model</code> ose rindërtoni imazhin Docker. Përkohësisht mund të ngarkoni eksportin nga Teachable Machine: <code>model.json</code>, <code>weights.bin</code>, <code>metadata.json</code>.</p>
                <label className="btn" htmlFor="modelFiles">Ngarko skedarët e modelit</label>
                <input id="modelFiles" className="sr" type="file" multiple accept=".json,.bin" onChange={(e) => onModelFiles(e.target.files)} />
              </div>
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="t-bio">
          <div className="panel-head">
            <h2 id="t-bio">Biomarkerët e pështymës</h2>
          </div>
          <div className="panel-body bio-body">
            <table className="markers">
              <thead>
                <tr><th scope="col">Markeri</th><th scope="col" className="num">Vlera</th><th scope="col">Normë</th><th scope="col">Niveli</th></tr>
              </thead>
              <tbody>
                {BIOMARKERS.map((m) => {
                  const err = parsed.errors[m.key];
                  const v = parsed.values[m.key];
                  const lvl = v !== undefined ? biomarkerLevel(m, v) : null;
                  return (
                    <tr key={m.key}>
                      <th scope="row"><label htmlFor={`bm-${m.key}`}>{m.label} <small>{m.unit}</small></label></th>
                      <td className="num">
                        <input
                          id={`bm-${m.key}`} inputMode="decimal" autoComplete="off"
                          value={values[m.key]} aria-invalid={!!err} aria-describedby={`h-${m.key}`}
                          onChange={(e) => { setValues((v) => ({ ...v, [m.key]: e.target.value })); setResult(null); }}
                        />
                      </td>
                      <td id={`h-${m.key}`} className={err ? "err ref" : "ref"}>
                        {err ?? <><span className="mono">{m.normalMin}–{m.normalMax}</span><small>OPMD ≤ {m.opmdMax} · OSCC &gt; {m.highAbove}</small></>}
                      </td>
                      <td className="lvl" data-tone={lvl === null ? undefined : LEVEL_TONE[lvl]}>{lvl === null ? "—" : LEVEL_LABEL[lvl]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="run">
              <button type="button" className="primary" disabled={!canRun} onClick={process}>
                {busy ? "Duke analizuar…" : "Analizo"}
              </button>
              {!canRun && !busy && missing.length > 0 && <p className="hint">Mungon: {missing.join(", ")}</p>}
              {runError && <p className="err">{runError}</p>}
            </div>
          </div>
        </section>

        <section className="panel result" id="rezultati" aria-labelledby="t-res" aria-live="polite">
          <div className="panel-head">
            <h2 id="t-res">Rezultati</h2>
            {result && (
              <div className="head-actions">
                {resultAt && <time className="stamp" dateTime={resultAt.toISOString()}>{resultAt.toLocaleString("sq-AL", { dateStyle: "short", timeStyle: "short" })}</time>}
                <button type="button" className="link" onClick={() => window.print()}>Printo</button>
              </div>
            )}
          </div>
          <div className="panel-body">
            {result ? <ResultView r={result} labels={labels} /> : <EmptyResult />}
          </div>
        </section>
      </main>

      <footer className="foot">
        Mjet mbështetës për vendimmarrjen klinike, jo diagnozë. Çdo lezion i dyshimtë kërkon ekzaminim klinik dhe biopsi.
        Të dhënat përpunohen vetëm në këtë shfletues dhe nuk ruhen. · N. Kalaj, K. Kalaj, 2026
      </footer>
    </div>
  );
}

function bandRange(i: number) {
  const b = RISK_BANDS[i];
  if (i === 0) return `< ${b.upTo.toFixed(2)}`;
  if (i === RISK_BANDS.length - 1) return `≥ ${RISK_BANDS[i - 1].upTo.toFixed(2)}`;
  return `${RISK_BANDS[i - 1].upTo.toFixed(2)}–${b.upTo.toFixed(2)}`;
}

function EmptyResult() {
  return (
    <div className="res-empty">
      <p>Ngarkoni fotografinë, plotësoni vlerat e biomarkerëve dhe shtypni <b>Analizo</b>.</p>
      <dl className="legend">
        {RISK_BANDS.map((b, i) => (
          <div key={b.key}>
            <dt>{b.label}</dt>
            <dd className="mono">{bandRange(i)}</dd>
          </div>
        ))}
      </dl>
      <p className="method">
        Indeksi = {WEIGHTS.visual.toFixed(2)} × rreziku vizual + {WEIGHTS.chemical.toFixed(2)} × profili kimik
      </p>
    </div>
  );
}

function ResultView({ r, labels }: { r: Analysis; labels: string[] }) {
  const tone = BAND_TONE[r.band.key];
  const raised = r.chemical.results.filter((b) => b.level > 0);
  const at = Math.min(100, Math.max(0, r.fused * 100));
  return (
    <div className="res">
      <div className="verdict" data-tone={tone} id="verdict">
        <div className="verdict-score">
          <span className="verdict-label">Indeksi i rrezikut</span>
          <span className="verdict-num mono">{r.fused.toFixed(2)}</span>
        </div>
        <div className="verdict-text">
          <span className="verdict-band">{r.band.label}</span>
          <p className="verdict-advice">{r.band.advice}</p>
        </div>

        <div className="scale" aria-hidden="true">
          <div className="scale-track">
            {RISK_BANDS.map((b, i) => {
              const from = i === 0 ? 0 : RISK_BANDS[i - 1].upTo, to = Math.min(1, b.upTo);
              return (
                <span key={b.key} data-tone={BAND_TONE[b.key]} className={b.key === r.band.key ? "on" : ""} style={{ width: `${(to - from) * 100}%` }}>
                  {b.label}
                </span>
              );
            })}
          </div>
          <i className="scale-mark" style={{ left: `${at}%` }} />
          <div className="scale-ticks mono">
            <span>0</span>
            {RISK_BANDS.slice(0, -1).map((b) => <span key={b.key} style={{ left: `${b.upTo * 100}%` }}>{b.upTo.toFixed(2)}</span>)}
            <span>1</span>
          </div>
        </div>
      </div>

      {r.conflict && (
        <p className="conflict">Fotografia dhe pështyma japin rreziqe shumë të ndryshme. Vlerësojeni rastin klinikisht.</p>
      )}

      <div className="res-detail">
        <div className="block">
          <h3>Analiza e imazhit <span className="mono">{r.visual.score.toFixed(2)}</span></h3>
          <ul className="probs">
            {r.visual.predictions.map((p, i) => {
              const l = parseLabel(labels[i] ?? p.className);
              return (
                <li key={i} className={i === r.visual.topIndex ? "top" : ""}>
                  <span>{l.name}</span>
                  <div className="track"><div className="fill" style={{ width: `${p.probability * 100}%` }} /></div>
                  <span className="mono">{pct(p.probability)}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="block">
          <h3>Profili kimik <span className="mono">{r.chemical.score.toFixed(2)}</span></h3>
          <p className="summary">
            {raised.length === 0
              ? "Të katër biomarkerët brenda vlerave referente."
              : <>{raised.length} nga {r.chemical.results.length} mbi normë: {raised.map((b, i) => (
                  <span key={b.marker.key}>{i > 0 && ", "}<b>{b.marker.label}</b> <span className="mono">{b.value}</span> ({LEVEL_LABEL[b.level].toLowerCase()})</span>
                ))}</>}
          </p>
          <p className="method mono">
            {WEIGHTS.visual.toFixed(2)} × {r.visual.score.toFixed(2)} + {WEIGHTS.chemical.toFixed(2)} × {r.chemical.score.toFixed(2)} = {r.fused.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
