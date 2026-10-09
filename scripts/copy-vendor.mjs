// Copies the browser builds of TensorFlow.js and Teachable Machine into public/vendor,
// so the app serves them itself and never depends on a CDN at runtime.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
const out = "public/vendor";
mkdirSync(out, { recursive: true });
const files = [
  ["node_modules/@tensorflow/tfjs/dist/tf.min.js", "tf.min.js"],
  ["node_modules/@teachablemachine/image/dist/teachablemachine-image.min.js", "teachablemachine-image.min.js"],
];
for (const [src, name] of files) {
  if (!existsSync(src)) { console.warn(`[copy-vendor] missing ${src}`); continue; }
  copyFileSync(src, `${out}/${name}`);
  console.log(`[copy-vendor] ${name}`);
}
