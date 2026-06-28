// Canned demo incident — loaded server-side so the dashboard PNG can be read
// from disk and base64-encoded for Gemma's multimodal input.
import fs from "node:fs";
import path from "node:path";
import scenarioJson from "./data/scenario.json";
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

let _cachedImage: { base64: string; mime: string } | null | undefined;

function loadDashboardImage(): { base64: string; mime: string } | null {
  if (_cachedImage !== undefined) return _cachedImage;
  try {
    const p = path.join(
      process.cwd(),
      "public",
      "sample-incident-dashboard.png"
    );
    if (fs.existsSync(p)) {
      _cachedImage = {
        base64: fs.readFileSync(p).toString("base64"),
        mime: "image/png",
      };
    } else {
      _cachedImage = null;
    }
  } catch {
    _cachedImage = null;
  }
  return _cachedImage;
}

/** The full incident input for the canned demo. */
export function scenarioIncident(): IncidentInput {
  const img = loadDashboardImage();
  return {
    alertText: scenario.alertText,
    logs: scenario.logs,
    runbook: scenario.runbookMarkdown,
    imageBase64: img?.base64,
    imageMime: img?.mime,
  };
}
