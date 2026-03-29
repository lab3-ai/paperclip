import type { PluginSettingsPageProps } from "@paperclipai/plugin-sdk/ui";
import { usePluginData } from "@paperclipai/plugin-sdk/ui";

interface ScannerStatus {
  lastScanAt: string | null;
  scanRunning: boolean;
  coinCount: number;
  alertsTriggered: number;
}

export function CoingeckoScannerSettings({
  context,
}: PluginSettingsPageProps) {
  const { data: status, loading, refresh } = usePluginData<ScannerStatus>(
    "scanner-status",
    {},
  );

  return (
    <div style={{ padding: "1rem", maxWidth: 600 }}>
      <h2>CoinGecko Scanner</h2>

      <section style={{ marginTop: "1rem" }}>
        <h3>Scan Status</h3>
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
            <p>
              <strong>Coins tracked:</strong> {status?.coinCount ?? 0}
            </p>
            <p>
              <strong>Alerts (last scan):</strong>{" "}
              {status?.alertsTriggered ?? 0}
            </p>
            <button onClick={refresh} style={{ marginTop: "0.5rem" }}>
              Refresh
            </button>
          </div>
        )}
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h3>Configuration</h3>
        <p>
          Configure scan mode, coin watchlist, alert thresholds, and Company ID
          in the plugin configuration panel above.
        </p>
      </section>
    </div>
  );
}
