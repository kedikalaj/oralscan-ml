import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

// The weight file names come from model.json ("model.weights.bin" when hosted, "weights.bin" in an export).
function modelPresent(dir: string) {
  if (!["model.json", "metadata.json"].every((f) => existsSync(path.join(dir, f)))) return false;
  try {
    const manifest = JSON.parse(readFileSync(path.join(dir, "model.json"), "utf8")).weightsManifest ?? [];
    const paths: string[] = manifest.flatMap((g: { paths?: string[] }) => g.paths ?? []);
    return paths.length > 0 && paths.every((p) => existsSync(path.join(dir, p)));
  } catch {
    return false;
  }
}

export function GET() {
  const model = modelPresent(path.join(process.cwd(), "public", "model"));
  return Response.json({ ok: true, model });
}
