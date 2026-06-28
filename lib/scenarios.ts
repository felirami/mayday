// Multi-scenario registry (server-side). Each scenario carries its incident
// text + a bundled base64 dashboard image so the multimodal input works in any
// runtime. The client never imports this (it would ship ~700kb of base64);
// it uses the /api/scenarios endpoint instead.
import type { IncidentInput } from "./types";
import dbPool from "./data/scenarios/db-pool.json";
import redis from "./data/scenarios/redis-stampede.json";
import oom from "./data/scenarios/oom-leak.json";
import flag from "./data/scenarios/feature-flag.json";
import dep from "./data/scenarios/downstream-dep.json";
import dashboards from "./data/dashboards.b64.json";

export interface Scenario {
  id: string;
  domain: string;
  title: string;
  service: string;
  severity: string;
  remediationClass: string;
  alertText: string;
  dashboardSubtitle?: string;
  dashboardSpec?: string;
  logs: string;
  runbookMarkdown: string;
  groundTruthRootCause: string;
  expectedRemediation: string;
  expectedSlackUpdate: string;
}

const ALL = [dbPool, redis, oom, flag, dep] as unknown as Scenario[];
const DASH = dashboards as Record<string, { mime: string; base64: string }>;
const byId = new Map(ALL.map((s) => [s.id, s]));

export const SCENARIOS = ALL;
export const DEFAULT_SCENARIO_ID = "db-pool";

export function getScenario(id: string): Scenario | undefined {
  return byId.get(id);
}

/** Lightweight list for the picker. */
export function scenarioSummaries() {
  return ALL.map((s) => ({
    id: s.id,
    domain: s.domain,
    title: s.title,
    service: s.service,
    severity: s.severity,
    remediationClass: s.remediationClass,
    imageUrl: `/dashboards/${s.id}.png`,
  }));
}

/** Full text content for prefilling the intake panel. */
export function scenarioFull(id: string) {
  const s = byId.get(id);
  if (!s) return null;
  return {
    id: s.id,
    title: s.title,
    service: s.service,
    severity: s.severity,
    alertText: s.alertText,
    logs: s.logs,
    runbook: s.runbookMarkdown,
    imageUrl: `/dashboards/${s.id}.png`,
  };
}

/** The full incident input (including the base64 dashboard) for the orchestrator. */
export function scenarioIncident(id: string): IncidentInput | null {
  const s = byId.get(id);
  if (!s) return null;
  const d = DASH[id];
  return {
    alertText: s.alertText,
    logs: s.logs,
    runbook: s.runbookMarkdown,
    imageBase64: d?.base64,
    imageMime: d?.mime ?? "image/png",
  };
}
