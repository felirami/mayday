import { scenario } from "@/lib/scenario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    title: scenario.title,
    service: scenario.service,
    severity: scenario.severity,
    alertText: scenario.alertText,
    logs: scenario.logs,
    runbook: scenario.runbookMarkdown,
    hasImage: true,
    imageUrl: "/sample-incident-dashboard.png",
  });
}
