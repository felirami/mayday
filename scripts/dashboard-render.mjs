// Data-driven Grafana-style dashboard renderer. A scenario provides a `panels`
// spec (2x2 grid of timeseries panels with keypoint-defined series); this turns
// it into an SVG that visually matches the incident.
export const C = {
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
  cyan: "#56d3d8",
};

const W = 1280;
const H = 824;

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function noise(i, amp) {
  return ((Math.sin(i * 12.9898) * 43758.5453) % 1) * amp - amp / 2;
}

// keypoints: [[t,v],...] (t in 0..1). Returns sampled [[t,v]] with optional jitter.
function sampleSeries(points, jitter = 0, step = 0.01) {
  const pts = [];
  let ki = 0;
  for (let t = 0; t <= 1.0001; t += step) {
    const tt = Math.min(t, 1);
    while (ki < points.length - 2 && tt > points[ki + 1][0]) ki++;
    const [t0, v0] = points[ki];
    const [t1, v1] = points[Math.min(ki + 1, points.length - 1)];
    const f = t1 === t0 ? 0 : (tt - t0) / (t1 - t0);
    let v = lerp(v0, v1, Math.max(0, Math.min(1, f)));
    if (jitter) v += noise(tt * 137 + ki, jitter);
    pts.push([tt, v]);
  }
  return pts;
}

function mapX(t, px, pw) {
  return px + t * pw;
}
function mapY(v, vmin, vmax, py, ph) {
  return py + ph - ((v - vmin) / (vmax - vmin)) * ph;
}

function polyline(pts, px, py, pw, ph, vmin, vmax, color, width = 2.5) {
  const d = pts.map(([t, v]) => `${mapX(t, px, pw).toFixed(1)},${mapY(v, vmin, vmax, py, ph).toFixed(1)}`).join(" ");
  return `<polyline points="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
}
function area(pts, px, py, pw, ph, vmin, vmax, color, opacity) {
  const top = pts.map(([t, v]) => `${mapX(t, px, pw).toFixed(1)},${mapY(v, vmin, vmax, py, ph).toFixed(1)}`).join(" ");
  return `<polygon points="${mapX(0, px, pw).toFixed(1)},${(py + ph).toFixed(1)} ${top} ${mapX(1, px, pw).toFixed(1)},${(py + ph).toFixed(1)}" fill="${color}" opacity="${opacity}"/>`;
}

function renderPanel(x, y, w, h, panel, ann, ticks) {
  const px = x + 56;
  const py = y + 44;
  const pw = w - 56 - 18;
  const ph = h - 44 - 30;
  const vmin = panel.yMin ?? 0;
  const vmax = panel.yMax;

  const yl = (panel.yTicks ?? []).map(
    (v) => `<text x="${px - 8}" y="${mapY(v, vmin, vmax, py, ph) + 4}" fill="${C.sub}" font-size="11" text-anchor="end" font-family="monospace">${v}</text>`
  ).join("");

  const xlabels = ticks.map((lab, i) => {
    const t = i / (ticks.length - 1);
    const tx = mapX(t, px, pw);
    return `<line x1="${tx}" y1="${py}" x2="${tx}" y2="${py + ph}" stroke="${C.grid}" stroke-width="1"/><text x="${tx}" y="${py + ph + 18}" fill="${C.sub}" font-size="11" text-anchor="middle" font-family="sans-serif">${lab}</text>`;
  }).join("");

  let threshold = "";
  if (panel.threshold) {
    const ty = mapY(panel.threshold.v, vmin, vmax, py, ph);
    threshold = `<line x1="${px}" y1="${ty}" x2="${px + pw}" y2="${ty}" stroke="${panel.threshold.color ?? C.yellow}" stroke-width="1" stroke-dasharray="6 4" opacity="0.7"/><text x="${px + pw - 4}" y="${ty - 5}" fill="${panel.threshold.color ?? C.yellow}" font-size="10" text-anchor="end" font-family="monospace">${panel.threshold.label ?? ""}</text>`;
  }
  let maxline = "";
  if (panel.maxline) {
    const my = mapY(panel.maxline.v, vmin, vmax, py, ph);
    maxline = `<line x1="${px}" y1="${my}" x2="${px + pw}" y2="${my}" stroke="${C.sub}" stroke-width="1.5" stroke-dasharray="2 2"/><text x="${px + 6}" y="${my - 5}" fill="${C.sub}" font-size="10" font-family="monospace">${panel.maxline.label ?? ""}</text>`;
  }

  const seriesSvg = (panel.series ?? []).map((s) => {
    const pts = sampleSeries(s.points, s.jitter ?? 0);
    const fill = s.fill ? area(pts, px, py, pw, ph, vmin, vmax, s.color, s.fillOpacity ?? 0.14) : "";
    return fill + polyline(pts, px, py, pw, ph, vmin, vmax, s.color, s.width ?? 2.5);
  }).join("");

  let legend = "";
  if (panel.legend) {
    legend = panel.legend.map((lg, i) => {
      const lx = px + 6 + i * 96;
      return `<rect x="${lx}" y="${py + 6}" width="10" height="3" fill="${lg.color}"/><text x="${lx + 16}" y="${py + 13}" fill="${C.sub}" font-size="11" font-family="monospace">${lg.label}</text>`;
    }).join("");
  }

  let annSvg = "";
  if (ann) {
    const ax = mapX(ann.t, px, pw);
    annSvg = `<line x1="${ax}" y1="${py}" x2="${ax}" y2="${py + ph}" stroke="${ann.color ?? C.red}" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.85"/><text x="${ax + 4}" y="${py + 12}" fill="${ann.color ?? C.red}" font-size="11" font-family="monospace">${ann.label}</text>`;
  }

  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${C.panel}" stroke="${C.border}"/>
    <text x="${x + 14}" y="${y + 24}" fill="${C.text}" font-size="14" font-weight="600" font-family="sans-serif">${panel.title}</text>
    <text x="${x + w - 14}" y="${y + 26}" fill="${panel.statColor ?? C.text}" font-size="20" font-weight="700" text-anchor="end" font-family="monospace">${panel.stat ?? ""}</text>
    ${yl}${xlabels}${threshold}${maxline}${seriesSvg}${legend}${annSvg}
  </g>`;
}

export function renderDashboardSVG(spec) {
  const ticks = spec.ticks ?? ["t-20m", "t-15m", "t-10m", "t-5m", "now"];
  const layout = [
    [24, 64, 606, 332],
    [650, 64, 606, 332],
    [24, 412, 606, 332],
    [650, 412, 606, 332],
  ];
  const panels = spec.panels.slice(0, 4).map((p, i) => renderPanel(...layout[i], p, spec.annotation, ticks)).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <text x="24" y="38" fill="${C.text}" font-size="18" font-weight="700" font-family="sans-serif">${spec.title}</text>
  <text x="${W - 24}" y="38" fill="${C.sub}" font-size="13" text-anchor="end" font-family="monospace">${spec.subtitle ?? ""}</text>
  ${panels}
</svg>`;
}
