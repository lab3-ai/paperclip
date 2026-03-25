import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import { usePluginData } from "@paperclipai/plugin-sdk/ui";

interface ScannerStatus {
  lastScanAt: string | null;
  scanRunning: boolean;
}

export function XScannerSettings({ context }: PluginSettingsPageProps) {
  const { data: status, loading, refresh } = usePluginData<ScannerStatus>("scanner-status", {});

  return (
    <div style={{ padding: "1rem", maxWidth: 600 }}>
      <h2>X Scanner Settings</h2>
      <section style={{ marginTop: "1rem" }}>
        <h3>Status</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div>
            <p>
              <strong>Last scan:</strong>{" "}
              {status?.lastScanAt
                ? new Date(status.lastScanAt).toLocaleString()
                : "Never"}
            </p>
            <p>
              <strong>Scan running:</strong>{" "}
              {status?.scanRunning ? "Yes" : "No"}
            </p>
            <button onClick={refresh}>Refresh</button>
          </div>
        )}
      </section>
      <section style={{ marginTop: "1rem" }}>
        <h3>Configuration</h3>
        <p>
          Configure members, API keys, and scan interval in the plugin
          configuration panel.
        </p>
      </section>
    </div>
  );
}
