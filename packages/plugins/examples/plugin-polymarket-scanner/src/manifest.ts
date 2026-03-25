import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "lab3-ai.plugin-polymarket-scanner",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Polymarket Scanner",
  description:
    "Scans Polymarket via Gamma API, uses AI to analyze relevance, saves to Supabase, and triggers notifications",
  author: "lab3-ai",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "jobs.schedule",
    "plugin.state.read",
    "plugin.state.write",
    "secrets.read-ref",
    "events.emit",
    "agents.read",
    "agent.sessions.create",
    "agent.sessions.send",
    "activity.log.write",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    type: "object",
    required: ["supabaseUrl", "supabaseServiceKey", "companyId", "keywords", "agentSlug"],
    properties: {
      supabaseUrl: { type: "string", title: "Supabase URL" },
      supabaseServiceKey: { type: "string", title: "Supabase Service Key", format: "secret-ref" },
      companyId: { type: "string", title: "Company ID" },
      keywords: { type: "array", title: "Keywords", items: { type: "string" } },
      agentSlug: { type: "string", title: "Agent Slug (for AI analysis)" },
      minVolume: { type: "number", title: "Min Volume", default: 1000 },
      minAiRelevanceScore: { type: "number", title: "Min AI Score", default: 0.6 },
      scanIntervalMinutes: { type: "number", title: "Scan Interval (minutes)", default: 60 },
    },
  },
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  jobs: [
    {
      jobKey: "scan-polymarket",
      displayName: "Scan Polymarket Markets",
      description:
        "Fetch and analyze markets from Polymarket via Gamma API",
      schedule: "*/2 * * * *",
    },
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: "polymarket-scanner-settings",
        displayName: "Polymarket Scanner Settings",
        exportName: "PolymarketScannerSettings",
      },
    ],
  },
};

export default manifest;
