// Generates public/sample-incident-dashboard.png — a Grafana-style dark board
// that visually matches lib/data/scenario.json so Gemma's vision agent has a
// real, readable multimodal input. Run: node scripts/gen-dashboard.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const W = 1280;
const H = 824;

// Grafana dark palette
const C = {
  bg: "#0b0c0e",
  panel: "#181b1f",
  border: "#2a2e33",
  grid: "#23262b",
  text: "#d8d9da",
  sub: "#8e9097",
  green: "#73bf69",
  red: "#f2495c",
  yellow: "#fade2a",
  blue: "#5794f2",
  purple: "#b877d9",
  orange: "#ff9830",
};

const DEPLOY_T = 0.6; // 14:02 within 13:50–14:10

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function noise(i, amp) {
  // deterministic pseudo-noise
  return (Math.sin(i * 12.9898) * 43758.5453) % 1 * amp - amp / 2;
}

function series(fn, step = 0.01) {
  const pts = [];
  for (let t = 0; t <= 1.0001; t += step) pts.push([Math.min(t, 1), fn(Math.min(t, 1))]);
  return pts;
}

function mapX(t, px, pw) {
  return px + t * pw;
}
function mapY(v, vmin, vmax, py, ph) {
  return py + ph - ((v - vmin) / (vmax - vmin)) * ph;
}

function polyline(pts, px, py, pw, ph, vmin, vmax, color, width = 2.5) {
  const d = pts
    .map(([t, v]) => `${mapX(t, px, pw).toFixed(1)},${mapY(v, vmin, vmax, py, ph).toFixed(1)}`)
    .join(" ");
  return `<polyline points="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function area(pts, px, py, pw, ph, vmin, vmax, color, opacity = 0.18) {
  const top = pts
    .map(([t, v]) => `${mapX(t, px, pw).toFixed(1)},${mapY(v, vmin, vmax, py, ph).toFixed(1)}`)
    .join(" ");
  const x0 = mapX(0, px, pw).toFixed(1);
  const x1 = mapX(1, px, pw).toFixed(1);
  const y0 = (py + ph).toFixed(1);
  return `<polygon points="${x0},${y0} ${top} ${x1},${y0}" fill="${color}" opacity="${opacity}"/>`;
}

function panel(x, y, w, h, title, statText, statColor, inner) {
  const px = x + 56;
  const py = y + 44;
  const pw = w - 56 - 18;
  const ph = h - 44 - 30;
  // deploy annotation line
  const dx = mapX(DEPLOY_T, px, pw);
  const deploy = `
    <line x1="${dx}" y1="${py}" x2="${dx}" y2="${py + ph}" stroke="${C.red}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.85"/>
    <text x="${dx + 4}" y="${py + 12}" fill="${C.red}" font-size="11" font-family="monospace">deploy v2.31.0</text>`;
  // x axis labels
  const ticks = ["13:50", "13:55", "14:00", "14:05", "14:10"];
  const xlabels = ticks
    .map((lab, i) => {
      const t = i / (ticks.length - 1);
      const tx = mapX(t, px, pw);
      return `<line x1="${tx}" y1="${py}" x2="${tx}" y2="${py + ph}" stroke="${C.grid}" stroke-width="1"/>
        <text x="${tx}" y="${py + ph + 18}" fill="${C.sub}" font-size="11" text-anchor="middle" font-family="sans-serif">${lab}</text>`;
    })
    .join("");
  return `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${C.panel}" stroke="${C.border}"/>
    <text x="${x + 14}" y="${y + 24}" fill="${C.text}" font-size="14" font-weight="600" font-family="sans-serif">${title}</text>
    <text x="${x + w - 14}" y="${y + 26}" fill="${statColor}" font-size="20" font-weight="700" text-anchor="end" font-family="monospace">${statText}</text>
    ${xlabels}
    ${inner({ px, py, pw, ph })}
    ${deploy}
  </g>`;
}

// ── Panel 1: p99 latency ──
const p99 = series((t) => {
  if (t < DEPLOY_T) return 120 + noise(t * 100, 14);
  if (t < DEPLOY_T + 0.06) return lerp(120, 2400, (t - DEPLOY_T) / 0.06);
  return 2400 + noise(t * 90, 90);
});
const panel1 = panel(24, 64, 606, 332, "p99 latency (ms)", "2.41 s", C.red, ({ px, py, pw, ph }) => {
  const vmin = 0,
    vmax = 2700;
  const yl = [0, 800, 1600, 2400]
    .map(
      (v) =>
        `<text x="${px - 8}" y="${mapY(v, vmin, vmax, py, ph) + 4}" fill="${C.sub}" font-size="11" text-anchor="end" font-family="monospace">${v}</text>`
    )
    .join("");
  const threshold = `<line x1="${px}" y1="${mapY(800, vmin, vmax, py, ph)}" x2="${px + pw}" y2="${mapY(800, vmin, vmax, py, ph)}" stroke="${C.yellow}" stroke-width="1" stroke-dasharray="6 4" opacity="0.7"/>
    <text x="${px + pw - 4}" y="${mapY(800, vmin, vmax, py, ph) - 5}" fill="${C.yellow}" font-size="10" text-anchor="end" font-family="monospace">warn 800ms</text>`;
  return yl + threshold + area(p99, px, py, pw, ph, vmin, vmax, C.red, 0.14) + polyline(p99, px, py, pw, ph, vmin, vmax, C.red);
});

// ── Panel 2: HTTP status rate ──
const status5xx = series((t) => {
  if (t < DEPLOY_T) return 0.1;
  if (t < DEPLOY_T + 0.04) return lerp(0.1, 6.8, (t - DEPLOY_T) / 0.04);
  return 6.8 + noise(t * 80, 0.6);
});
const panel2 = panel(650, 64, 606, 332, "HTTP status rate (%)", "5xx 6.8%", C.red, ({ px, py, pw, ph }) => {
  const vmin = 0,
    vmax = 10;
  // green 2xx band (full) then red 5xx band on top, scaled x3 for visibility
  const greenTop = series(() => 9.6);
  const redBand = status5xx.map(([t, v]) => [t, Math.min(9.8, v * 1.0)]);
  const yl = [0, 2.5, 5, 7.5, 10]
    .map(
      (v) =>
        `<text x="${px - 8}" y="${mapY(v, vmin, vmax, py, ph) + 4}" fill="${C.sub}" font-size="11" text-anchor="end" font-family="monospace">${v}</text>`
    )
    .join("");
  const green = area(greenTop, px, py, pw, ph, vmin, vmax, C.green, 0.22);
  const red = area(redBand, px, py, pw, ph, vmin, vmax, C.red, 0.55) + polyline(redBand, px, py, pw, ph, vmin, vmax, C.red, 2);
  const legend = `<rect x="${px + 6}" y="${py + 6}" width="10" height="10" fill="${C.green}" opacity="0.6"/><text x="${px + 20}" y="${py + 15}" fill="${C.sub}" font-size="11" font-family="monospace">2xx 93.2%</text>
    <rect x="${px + 110}" y="${py + 6}" width="10" height="10" fill="${C.red}" opacity="0.7"/><text x="${px + 124}" y="${py + 15}" fill="${C.sub}" font-size="11" font-family="monospace">5xx 6.8%</text>`;
  return yl + green + red + legend;
});

// ── Panel 3: DB connection pool ──
const poolActive = series((t) => {
  if (t < DEPLOY_T + 0.01) return 15 + noise(t * 70, 4);
  if (t < DEPLOY_T + 0.05) return lerp(15, 100, (t - DEPLOY_T - 0.01) / 0.04);
  return 100;
});
const poolPending = series((t) => {
  if (t < DEPLOY_T + 0.02) return 0;
  if (t < DEPLOY_T + 0.08) return lerp(0, 58, (t - DEPLOY_T - 0.02) / 0.06);
  return 58 + noise(t * 60, 6);
});
const panel3 = panel(24, 412, 606, 332, "DB connection pool (HikariPool-1): active vs max", "100 / 100", C.red, ({ px, py, pw, ph }) => {
  const vmin = 0,
    vmax = 110;
  const yl = [0, 25, 50, 75, 100]
    .map(
      (v) =>
        `<text x="${px - 8}" y="${mapY(v, vmin, vmax, py, ph) + 4}" fill="${C.sub}" font-size="11" text-anchor="end" font-family="monospace">${v}</text>`
    )
    .join("");
  const maxLine = `<line x1="${px}" y1="${mapY(100, vmin, vmax, py, ph)}" x2="${px + pw}" y2="${mapY(100, vmin, vmax, py, ph)}" stroke="${C.sub}" stroke-width="1.5" stroke-dasharray="2 2"/>
    <text x="${px + 6}" y="${mapY(100, vmin, vmax, py, ph) - 5}" fill="${C.sub}" font-size="10" font-family="monospace">max 100</text>`;
  const legend = `<rect x="${px + pw - 150}" y="${py + 6}" width="10" height="3" fill="${C.blue}"/><text x="${px + pw - 134}" y="${py + 13}" fill="${C.sub}" font-size="11" font-family="monospace">active</text>
    <rect x="${px + pw - 80}" y="${py + 6}" width="10" height="3" fill="${C.orange}"/><text x="${px + pw - 64}" y="${py + 13}" fill="${C.sub}" font-size="11" font-family="monospace">pending</text>`;
  return (
    yl +
    maxLine +
    area(poolActive, px, py, pw, ph, vmin, vmax, C.blue, 0.16) +
    polyline(poolActive, px, py, pw, ph, vmin, vmax, C.blue) +
    polyline(poolPending, px, py, pw, ph, vmin, vmax, C.orange, 2) +
    legend
  );
});

// ── Panel 4: requests/sec ──
const rps = series((t) => 1200 + noise(t * 120, 60) + Math.sin(t * 30) * 25);
const panel4 = panel(650, 412, 606, 332, "requests/sec (RPS)", "1.20k rps", C.green, ({ px, py, pw, ph }) => {
  const vmin = 0,
    vmax = 2000;
  const yl = [0, 500, 1000, 1500, 2000]
    .map(
      (v) =>
        `<text x="${px - 8}" y="${mapY(v, vmin, vmax, py, ph) + 4}" fill="${C.sub}" font-size="11" text-anchor="end" font-family="monospace">${v}</text>`
    )
    .join("");
  return yl + area(rps, px, py, pw, ph, vmin, vmax, C.green, 0.12) + polyline(rps, px, py, pw, ph, vmin, vmax, C.green);
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <text x="24" y="38" fill="${C.text}" font-size="18" font-weight="700" font-family="sans-serif">checkout-service / overview</text>
  <text x="${W - 24}" y="38" fill="${C.sub}" font-size="13" text-anchor="end" font-family="monospace">prod · us-east-1 · 13:50–14:10 UTC</text>
  ${panel1}
  ${panel2}
  ${panel3}
  ${panel4}
</svg>`;

const outDir = path.join(root, "public");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "sample-incident-dashboard.png");
const svgDebug = path.join(outDir, "sample-incident-dashboard.svg");
fs.writeFileSync(svgDebug, svg);

const sharpMod = sharp.default ?? sharp;
await sharpMod(Buffer.from(svg)).png().toFile(out);
console.log("wrote", out);
