# OralScan AI

Next.js web app for the study *“Roli i Inteligjencës Artificiale në zbulimin e hershëm të kancerit oral”* (N. Kalaj, K. Kalaj, 2026).

1. Upload an intraoral photo. The Teachable Machine CNN gives the probability of each class: Normale, Benigne, OPMD, Maligne.
2. Enter the four salivary biomarkers: IL-6, IL-8, TNF-α and MMP-9.
3. Press **Analizo**. The app fuses both modules into one risk index:

```
visual score   = Σ P(class) × weight      weights: Normale 0, Benigne 1/3, OPMD 2/3, Maligne 1
chemical score = mean of biomarker levels  Normal = 0, I rritur = 0.5, I lartë = 1
risk index     = 0.40 × visual + 0.60 × chemical
                 < 0.33 low · 0.33–0.66 medium · ≥ 0.66 high
```

Everything runs in the visitor's browser. Photos and values are never uploaded to or stored on the server. The model and the TensorFlow.js libraries are served by the app itself, so nothing is loaded from Google or a CDN at runtime.

## Run it on your VPS (Docker)

Requirements: a Linux VPS with Docker and the Compose plugin (`curl -fsSL https://get.docker.com | sh`).

```bash
# 1. copy the project to the server, e.g. from your PC:
scp oralscan-ai.zip root@YOUR_VPS_IP:/opt/
# 2. on the server:
cd /opt && unzip oralscan-ai.zip && cd oralscan-ai
docker compose up -d --build
```

Open `http://YOUR_VPS_IP:3000`. Check it is healthy with `curl http://localhost:3000/api/health`, which should return `{"ok":true,"model":true}`.

During the build, `scripts/fetch-model.sh` downloads `model.json`, `metadata.json` and the weight file(s) listed in `model.json` (`model.weights.bin` for a hosted model) from your Teachable Machine link into `public/model/`. The files are then baked into the image.

### Common commands

| Task | Command |
|---|---|
| Logs | `docker compose logs -f` |
| Stop | `docker compose down` |
| Rebuild after editing code | `docker compose up -d --build` |
| Use a retrained model (new link) | change `TM_MODEL_URL` in `docker-compose.yml`, then `docker compose build --no-cache && docker compose up -d` |

### Use your own exported model instead of the link

In Teachable Machine choose **Export Model → Tensorflow.js → Download my model**. Unzip it and put the three files in `public/model/`. The build then skips the download.

### Domain + HTTPS (optional)

Point a DNS A record at the VPS, then put Caddy in front. Replace the `ports:` block in `docker-compose.yml` with `expose: ["3000"]` and add:

```yaml
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    command: caddy reverse-proxy --from oralscan.yourdomain.com --to oralscan:3000
    volumes: ["caddy_data:/data"]
volumes:
  caddy_data:
```

## Adjusting the clinical cut-offs

All clinical numbers live in **`lib/config.ts`**: module weights (40/60), class weights, normal ranges, the “high” threshold for each biomarker, and the risk bands. Set them to the values from your Excel sheet, then rebuild.

The cut-offs come from the study table. A value above `normalMax` is *I rritur* (OPMD range); a value above `highAbove` is *I lartë* (OSCC range): IL-6 > 15 pg/mL, IL-8 > 600 pg/mL, TNF-α > 10 pg/mL, MMP-9 > 214 ng/mL. Values in the gap between the OPMD range and the OSCC cut-off (e.g. IL-8 501–600) still count as *I rritur*.

## Local development

```bash
npm install          # also copies the TF.js browser builds into public/vendor
npm run fetch-model  # downloads the model into public/model
npm run dev          # http://localhost:3000
```

---
Research and demonstration tool. Not a medical device and not a diagnosis.
