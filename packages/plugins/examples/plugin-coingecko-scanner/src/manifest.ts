import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "lab3-ai.plugin-coingecko-scanner",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "CoinGecko Scanner",
  description:
    "Scans crypto market data from CoinGecko — prices, trends, volume alerts",
  author: "lab3-ai",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "jobs.schedule",
    "plugin.state.read",
    "plugin.state.write",
    "events.emit",
    "issues.create",
    "activity.log.write",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string", title: "Company ID" },
      scanMode: {
        type: "string",
        title: "Scan Mode",
        enum: ["top", "trending", "watchlist", "all"],
        default: "top",
      },
      watchlistCoinIds: {
        type: "string",
        title: "Watchlist Coin IDs (comma-separated)",
        default: "bitcoin,ethereum,solana",
      },
      topCoinsLimit: {
        type: "number",
        title: "Top Coins Limit",
        default: 20,
      },
      priceChangeThreshold: {
        type: "number",
        title: "Price Change Alert Threshold (%)",
        default: 10,
      },
      volumeChangeThreshold: {
        type: "number",
        title: "Volume Change Alert Threshold (%)",
        default: 50,
      },
      currency: { type: "string", title: "Currency", default: "usd" },
    },
  },
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  jobs: [
    {
      jobKey: "scan-coingecko",
      displayName: "Scan CoinGecko Markets",
      description:
        "Fetch crypto market data and detect price/volume anomalies",
      schedule: "*/5 * * * *",
    },
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: "coingecko-scanner-settings",
        displayName: "CoinGecko Scanner Settings",
        exportName: "CoingeckoScannerSettings",
      },
    ],
  },
};

export default manifest;
