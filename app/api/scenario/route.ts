import { scenario } from "@/lib/scenario";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const imgPath = path.join(
    process.cwd(),
    "public",
    "sample-incident-dashboard.png"
  );
  const hasImage = fs.existsSync(imgPath);
  return Response.json({
    title: scenario.title,
    service: scenario.service,
    severity: scenario.severity,
    alertText: scenario.alertText,
    logs: scenario.logs,
    runbook: scenario.runbookMarkdown,
    hasImage,
    imageUrl: hasImage ? "/sample-incident-dashboard.png" : null,
  });
}
