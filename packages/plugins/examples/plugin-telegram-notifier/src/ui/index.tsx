import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import { usePluginData, usePluginAction, usePluginToast } from "@paperclipai/plugin-sdk/ui";

interface NotifierStatus {
  lastSentAt: string | null;
}

export function TelegramNotifierSettings({ context }: PluginSettingsPageProps) {
  const toast = usePluginToast();
  const { data: status, loading, refresh } = usePluginData<NotifierStatus>(
    "notifier-status",
    {},
  );
  const testSend = usePluginAction("test-send");

  const handleTestSend = async () => {
    try {
      await testSend({});
      toast({ title: "Test message sent to Telegram", tone: "info" });
    } catch (err) {
      toast({ title: `Failed: ${String(err)}`, tone: "error" });
    }
  };

  return (
    <div style={{ padding: "1rem", maxWidth: 600 }}>
      <h2>Telegram Notifier Settings</h2>
      <section style={{ marginTop: "1rem" }}>
        <h3>Status</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <p>
            <strong>Last sent:</strong>{" "}
            {status?.lastSentAt
              ? new Date(status.lastSentAt).toLocaleString()
              : "Never"}
          </p>
        )}
      </section>
      <section style={{ marginTop: "1rem" }}>
        <button onClick={handleTestSend}>Send Test Message</button>
        <button onClick={refresh} style={{ marginLeft: "0.5rem" }}>
          Refresh
        </button>
      </section>
    </div>
  );
}
