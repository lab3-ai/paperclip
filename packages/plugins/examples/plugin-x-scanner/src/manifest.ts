import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "lab3-ai.plugin-x-scanner";
const PLUGIN_VERSION = "0.1.0";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "X Post Scanner",
  description:
    "Scans X (Twitter) posts from configured members via RapidAPI and saves to Supabase",
  author: "lab3-ai",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "jobs.schedule",
    "plugin.state.read",
    "plugin.state.write",
    "secrets.read-ref",
    "activity.log.write",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    type: "object",
    required: ["rapidApiKey", "supabaseUrl", "supabaseServiceKey", "companyId", "members"],
    properties: {
      rapidApiKey: { type: "string", title: "RapidAPI Key", format: "secret-ref" },
      supabaseUrl: { type: "string", title: "Supabase URL" },
      supabaseServiceKey: { type: "string", title: "Supabase Service Key", format: "secret-ref" },
      companyId: { type: "string", title: "Company ID" },
      members: { type: "array", title: "Twitter Handles", items: { type: "string" } },
      scanIntervalMinutes: { type: "number", title: "Scan Interval (minutes)", default: 15 },
      maxPostsPerMember: { type: "number", title: "Max Posts per Member", default: 20 },
    },
  },
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  jobs: [
    {
      jobKey: "scan-x-posts",
      displayName: "Scan X Posts",
      description: "Fetch recent posts from configured X members",
      schedule: "* * * * *",
    },
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: "x-scanner-settings",
        displayName: "X Scanner Settings",
        exportName: "XScannerSettings",
      },
    ],
  },
};

export default manifest;
