import { type HRPacket, hrToZone, parseHeartRate, rmssd } from '@hrkit/core';

const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tabs button'));
const panels = Array.from(document.querySelectorAll<HTMLElement>('.panel'));

function activate(tab: string): void {
  for (const b of tabs) b.classList.toggle('active', b.dataset.tab === tab);
  for (const p of panels) p.classList.toggle('active', p.id === `panel-${tab}`);
  updateShareUrl();
}
for (const b of tabs) b.addEventListener('click', () => activate(b.dataset.tab ?? 'live'));

const params = new URLSearchParams(location.search);
const initialMode = params.get('mode');
if (initialMode === 'fixture' || initialMode === 'share') activate(initialMode);

// ── Live (Web Bluetooth) ───────────────────────────────────────────────

const HR_SERVICE = 0x180d;
const HR_CHAR = 0x2a37;
const ZONE_CONFIG = { maxHR: 190, restHR: 60, zones: [0.6, 0.7, 0.8, 0.9] as [number, number, number, number] };

const statusEl = document.getElementById('status') as HTMLElement;
const hrEl = document.getElementById('hr') as HTMLElement;
const zoneEl = document.getElementById('zone') as HTMLElement;
const rmssdEl = document.getElementById('rmssd') as HTMLElement;
const recentRR: number[] = [];

document.getElementById('btn-pair')?.addEventListener('click', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: Web Bluetooth API not in standard lib types
  const nav = navigator as any;
  if (!nav.bluetooth) {
    statusEl.textContent = 'Web Bluetooth not available in this browser.';
    return;
  }
  try {
    const device = await nav.bluetooth.requestDevice({ filters: [{ services: [HR_SERVICE] }] });
    statusEl.textContent = `Connecting to ${device.name ?? 'device'}…`;
    const server = await device.gatt?.connect();
    const svc = await server?.getPrimaryService(HR_SERVICE);
    const ch = await svc?.getCharacteristic(HR_CHAR);
    await ch?.startNotifications();
    ch?.addEventListener('characteristicvaluechanged', (ev: Event) => {
      const target = ev.target as { value?: DataView } | null;
      if (!target?.value) return;
      const packet: HRPacket = parseHeartRate(target.value, performance.now());
      hrEl.textContent = String(packet.hr);
      zoneEl.textContent = String(hrToZone(packet.hr, ZONE_CONFIG));
      if (packet.rrIntervals.length) {
        recentRR.push(...packet.rrIntervals);
        if (recentRR.length > 60) recentRR.splice(0, recentRR.length - 60);
        rmssdEl.textContent = recentRR.length >= 2 ? rmssd(recentRR).toFixed(1) : '—';
      }
    });
    statusEl.textContent = `Connected: ${device.name ?? 'device'}`;
  } catch (err) {
    statusEl.textContent = `Pairing failed: ${(err as Error).message}`;
  }
});

// ── Fixture replay ─────────────────────────────────────────────────────

const replayOut = document.getElementById('replay-out') as HTMLElement;
const fixturePick = document.getElementById('fixture-pick') as HTMLSelectElement;

document.getElementById('btn-replay')?.addEventListener('click', async () => {
  const name = fixturePick.value;
  replayOut.textContent = `Loading ${name}…`;
  try {
    const url = `/fixtures/${name}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const fx = (await res.json()) as { notifications: Array<{ timestamp: number; hex: string }> };
    const out: string[] = [];
    for (const n of fx.notifications) {
      const bytes = Uint8Array.from(n.hex.match(/.{1,2}/g) ?? [], (h) => Number.parseInt(h, 16));
      const view = new DataView(bytes.buffer);
      const p = parseHeartRate(view, n.timestamp);
      out.push(`t=${n.timestamp}ms  hr=${p.hr}  rr=[${p.rrIntervals.join(',')}]`);
    }
    replayOut.textContent = out.join('\n');
  } catch (err) {
    replayOut.textContent = `Error: ${(err as Error).message}`;
  }
});

// ── Share URL ──────────────────────────────────────────────────────────

const shareEl = document.getElementById('share-url') as HTMLInputElement;
function updateShareUrl(): void {
  const active = document.querySelector('.tabs button.active') as HTMLButtonElement | null;
  const mode = active?.dataset.tab ?? 'live';
  const u = new URL(location.href);
  u.searchParams.set('mode', mode);
  if (mode === 'fixture') u.searchParams.set('name', fixturePick.value);
  else u.searchParams.delete('name');
  shareEl.value = u.toString();
}
fixturePick?.addEventListener('change', updateShareUrl);
updateShareUrl();
