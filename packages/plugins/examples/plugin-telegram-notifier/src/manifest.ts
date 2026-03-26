import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "lab3-ai.plugin-telegram-notifier",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Telegram Notifier",
  description: "Sends Polymarket alerts to a Telegram group via bot",
  author: "lab3-ai",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "secrets.read-ref",
    "activity.log.write",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    type: "object",
    required: ["botToken", "chatId", "supabaseUrl", "supabaseServiceKey"],
    properties: {
      botToken: { type: "string", title: "Telegram Bot Token", format: "secret-ref" },
      chatId: { type: "string", title: "Telegram Chat ID" },
      supabaseUrl: { type: "string", title: "Supabase URL" },
      supabaseServiceKey: { type: "string", title: "Supabase Service Key", format: "secret-ref" },
    },
  },
  entrypoints: { worker: "./dist/worker.js", ui: "./dist/ui" },
  ui: {
    slots: [{
      type: "settingsPage",
      id: "telegram-notifier-settings",
      displayName: "Telegram Notifier Settings",
      exportName: "TelegramNotifierSettings",
    }],
  },
};
export default manifest;
