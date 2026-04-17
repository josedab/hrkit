import { connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { WebBluetoothTransport } from '@hrkit/web';
import { registerAll } from '@hrkit/widgets';

registerAll();

const logEl = document.getElementById('log') as HTMLPreElement;
const connectBtn = document.getElementById('connect') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnect') as HTMLButtonElement;
const unsupported = document.getElementById('unsupported') as HTMLDivElement;
const display = document.getElementById('display') as HTMLElement & { update(hr: number): void };
const chart = document.getElementById('chart') as HTMLElement & {
  addPoint(hr: number, timestamp?: number): void;
};

function log(line: string) {
  const prefix = `${new Date().toLocaleTimeString()}  ${line}`;
  logEl.textContent = `${prefix}\n${logEl.textContent ?? ''}`.slice(0, 4000);
}

if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
  unsupported.hidden = false;
  connectBtn.disabled = true;
}

let cancelStream = false;
let activeDisconnect: (() => Promise<void>) | null = null;

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true;
  log('Requesting device…');
  try {
    const transport = new WebBluetoothTransport();
    const connection = await connectToDevice(transport, { fallback: GENERIC_HR });
    log(`Connected to ${connection.deviceName || connection.deviceId}`);
    disconnectBtn.disabled = false;

    cancelStream = false;
    activeDisconnect = async () => {
      cancelStream = true;
      await connection.disconnect();
      log('Disconnected');
      activeDisconnect = null;
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    };

    void connection.onDisconnect.then(() => {
      if (activeDisconnect) {
        log('Device disconnected');
        cancelStream = true;
        activeDisconnect = null;
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
      }
    });

    for await (const packet of connection.heartRate()) {
      if (cancelStream) break;
      display.update(packet.hr);
      chart.addPoint(packet.hr, packet.timestamp);
    }
  } catch (err) {
    log(`Error: ${(err as Error).message}`);
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
  }
});

disconnectBtn.addEventListener('click', async () => {
  if (activeDisconnect) {
    await activeDisconnect();
  }
});
