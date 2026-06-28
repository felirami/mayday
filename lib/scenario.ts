// Canned demo incident. The dashboard image is bundled as base64 (not read from
// disk) so the multimodal input works in any runtime, including Vercel functions.
import scenarioJson from "./data/scenario.json";
import dashboard from "./data/dashboard.b64.json";
import type { IncidentInput } from "./types";

export interface Scenario {
  title: string;
  service: string;
  severity: string;
  alertText: string;
  dashboardSpec: string;
  logs: string;
  runbookMarkdown: string;
  groundTruthRootCause: string;
  expectedRemediation: string;
  expectedSlackUpdate: string;
}

export const scenario = scenarioJson as Scenario;
const dash = dashboard as { mime: string; base64: string };

/** The full incident input for the canned demo. */
export function scenarioIncident(): IncidentInput {
  return {
    alertText: scenario.alertText,
    logs: scenario.logs,
    runbook: scenario.runbookMarkdown,
    imageBase64: dash.base64 || undefined,
    imageMime: dash.mime || "image/png",
  };
}
