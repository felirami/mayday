// Renders a dashboard PNG for every scenario in lib/data/scenarios/*.json and
// bundles them as base64 into lib/data/dashboards.b64.json.
// Run: node scripts/gen-dashboards.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { renderDashboardSVG } from "./dashboard-render.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const scenDir = path.join(root, "lib", "data", "scenarios");
const outDir = path.join(root, "public", "dashboards");
fs.mkdirSync(outDir, { recursive: true });

const sharpMod = sharp.default ?? sharp;
const files = fs.readdirSync(scenDir).filter((f) => f.endsWith(".json"));
const bundle = {};

for (const f of files) {
  const s = JSON.parse(fs.readFileSync(path.join(scenDir, f), "utf8"));
  const spec = {
    title: `${s.service} / overview`,
    subtitle: s.dashboardSubtitle ?? "",
    annotation: s.annotation,
    ticks: s.ticks,
    panels: s.panels,
  };
  const svg = renderDashboardSVG(spec);
  const png = await sharpMod(Buffer.from(svg)).png().toFile(path.join(outDir, `${s.id}.png`));
  bundle[s.id] = {
    mime: "image/png",
    base64: fs.readFileSync(path.join(outDir, `${s.id}.png`)).toString("base64"),
  };
  console.log(`✓ ${s.id}  (${png.width}x${png.height}, ${Math.round(bundle[s.id].base64.length / 1024)}kb b64)`);
}

fs.writeFileSync(
  path.join(root, "lib", "data", "dashboards.b64.json"),
  JSON.stringify(bundle)
);
console.log(`wrote lib/data/dashboards.b64.json with ${Object.keys(bundle).length} dashboards`);
