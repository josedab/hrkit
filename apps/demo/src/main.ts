import { connectToDevice } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';
import { WebBluetoothTransport } from '@hrkit/web';
import { registerAll } from '@hrkit/widgets';
import { runReplay } from './replay.js';
import { runSimulated } from './simulated.js';

registerAll();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const logEl = $<HTMLPreElement>('log');
const startBtn = $<HTMLButtonElement>('start');
const stopBtn = $<HTMLButtonElement>('stop');
const scenario = $<HTMLSelectElement>('scenario');
const brand = $<HTMLSelectElement>('brand');
const brandLabel = $<HTMLLabelElement>('brand-label');
const unsupported = $<HTMLDivElement>('unsupported');
const display = $<HTMLElement & { update(hr: number): void }>('display');
const chart = $<HTMLElement & { addPoint(hr: number, timestamp?: number): void }>('chart');
const zonebar = $<HTMLElement & { update(hr: number): void }>('zonebar');
const ecg = $<HTMLElement & { addSamples(samples: number[], timestamp?: number): void }>('ecg');

function log(line: string) {
  const prefix = `${new Date().toLocaleTimeString()}  ${line}`;
  logEl.textContent = `${prefix}\n${logEl.textContent ?? ''}`.slice(0, 4000);
}

const webBluetoothAvailable = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
if (!webBluetoothAvailable) {
  unsupported.hidden = false;
  for (const opt of Array.from(scenario.options)) {
    if (opt.value === 'live') opt.disabled = true;
  }
  if (scenario.value === 'live') scenario.value = 'simulated';
}

function syncBrandVisibility() {
  const show = scenario.value === 'simulated';
  brand.hidden = !show;
  brandLabel.hidden = !show;
}
syncBrandVisibility();
scenario.addEventListener('change', syncBrandVisibility);

let cancel: (() => void | Promise<void>) | null = null;

function setRunning(running: boolean) {
  startBtn.disabled = running;
  stopBtn.disabled = !running;
  scenario.disabled = running;
}

function pushHr(hr: number, timestamp?: number) {
  display.update(hr);
  chart.addPoint(hr, timestamp);
  zonebar.update(hr);
}

async function startLive() {
  log('Requesting BLE device…');
  const transport = new WebBluetoothTransport();
  const conn = await connectToDevice(transport, { fallback: GENERIC_HR });
  log(`Connected to ${conn.deviceName || conn.deviceId}`);
  let stopped = false;
  cancel = async () => {
    stopped = true;
    await conn.disconnect();
    log('Disconnected');
  };
  for await (const packet of conn.heartRate()) {
    if (stopped) break;
    pushHr(packet.hr, packet.timestamp);
  }
}

async function startSimulated() {
  const selected = (brand.value as 'polar' | 'garmin' | 'wahoo' | 'generic') ?? 'polar';
  log(`Starting simulated Tabata (${selected}) — 8×20s on / 10s off`);
  const stop = runSimulated({
    brand: selected,
    onHr: (hr, t) => pushHr(hr, t),
    onEcg: (samples, t) => ecg.addSamples(samples, t),
  });
  cancel = () => {
    stop();
    log('Simulation stopped');
  };
}

async function startReplay() {
  log('Replaying sample recording (2-minute easy run)');
  const stop = runReplay({
    onHr: (hr, t) => pushHr(hr, t),
    onComplete: () => {
      log('Replay complete');
      teardown();
    },
  });
  cancel = () => {
    stop();
    log('Replay stopped');
  };
}

function teardown() {
  cancel = null;
  setRunning(false);
}

startBtn.addEventListener('click', async () => {
  setRunning(true);
  try {
    switch (scenario.value) {
      case 'live':
        await startLive();
        break;
      case 'replay':
        await startReplay();
        return;
      default:
        await startSimulated();
        return;
    }
  } catch (err) {
    log(`Error: ${(err as Error).message}`);
  } finally {
    if (scenario.value === 'live') teardown();
  }
});

stopBtn.addEventListener('click', async () => {
  if (cancel) await cancel();
  teardown();
});
