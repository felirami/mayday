import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Mayday — AI Incident Commander on Gemma 4 + Cerebras";

const STATS: [string, string][] = [
  ["10 / 10", "incidents diagnosed"],
  ["~2.3s", "per incident"],
  ["~3,000", "tokens / sec"],
  ["3", "domains · 6 fix types"],
];

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#07080a",
          backgroundImage:
            "radial-gradient(900px 500px at 50% -20%, rgba(251,91,107,0.16), transparent 60%)",
          padding: "62px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 22, height: 22, borderRadius: 11, background: "#fb5b6b", marginRight: 20, boxShadow: "0 0 24px #fb5b6b" }} />
            <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: "#e6e8ee", letterSpacing: -2 }}>MAYDAY</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#8b909c" }}>
            Gemma 4 31B · <span style={{ color: "#fb7185", marginLeft: 8 }}>Cerebras</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#e6e8ee", lineHeight: 1.2 }}>
            AI Incident Commander
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#8b909c", marginTop: 14, maxWidth: 1000, lineHeight: 1.35 }}>
            A swarm of 6 Gemma 4 agents reads your dashboard, hunts the logs, argues to consensus, and ships a safe fix — in seconds.
          </div>
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          {STATS.map(([v, l]) => (
            <div
              key={l}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#12151b",
                border: "1px solid #1f2430",
                borderRadius: 14,
                padding: "18px 24px",
                minWidth: 230,
              }}
            >
              <div style={{ display: "flex", fontSize: 46, fontWeight: 800, color: "#34d399" }}>{v}</div>
              <div style={{ display: "flex", fontSize: 20, color: "#8b909c", marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "#8b909c" }}>
          multimodal · multi-agent · speed-native · #Gemma4
        </div>
      </div>
    ),
    size
  );
}
