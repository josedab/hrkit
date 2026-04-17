import '@hrkit/widgets';
import { startSimulator } from './sim.js';

interface AthleteFrame {
  athleteId: string;
  name?: string;
  hr: number;
  zone?: number;
  rmssd?: number;
  atl?: number;
}

const grid = document.getElementById('grid') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const sourceEl = document.getElementById('source') as HTMLSpanElement;
const srcUri = document.getElementById('src-uri') as HTMLElement;

const params = new URLSearchParams(location.search);
const wsUrl = params.get('ws');

const cards = new Map<string, { hrEl: HTMLElement; zoneEl: HTMLElement; statsEl: HTMLElement }>();

function ensureCard(frame: AthleteFrame) {
  let card = cards.get(frame.athleteId);
  if (card) return card;

  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.innerHTML = `
    <h2><span class="name">${frame.name ?? frame.athleteId}</span><span class="id">${frame.athleteId}</span></h2>
    <hrkit-heart-rate></hrkit-heart-rate>
    <hrkit-zone-bar></hrkit-zone-bar>
    <div class="stats">
      <span class="stat">RMSSD: <b class="rmssd">—</b></span>
      <span class="stat">ATL: <b class="atl">—</b></span>
    </div>
  `;
  grid.appendChild(wrap);
  card = {
    hrEl: wrap.querySelector('hrkit-heart-rate') as HTMLElement,
    zoneEl: wrap.querySelector('hrkit-zone-bar') as HTMLElement,
    statsEl: wrap,
  };
  cards.set(frame.athleteId, card);
  return card;
}

function applyFrame(frame: AthleteFrame) {
  const card = ensureCard(frame);
  card.hrEl.setAttribute('hr', String(frame.hr));
  if (typeof frame.zone === 'number') card.zoneEl.setAttribute('zone', String(frame.zone));
  const rmssd = card.statsEl.querySelector('.rmssd');
  const atl = card.statsEl.querySelector('.atl');
  if (rmssd && typeof frame.rmssd === 'number') rmssd.textContent = frame.rmssd.toFixed(1);
  if (atl && typeof frame.atl === 'number') atl.textContent = frame.atl.toFixed(1);
}

function connectWs(url: string) {
  sourceEl.textContent = 'live';
  srcUri.textContent = url;
  const ws = new WebSocket(url);
  ws.addEventListener('open', () => {
    statusEl.textContent = 'live';
    statusEl.className = 'pill ok';
  });
  ws.addEventListener('close', () => {
    statusEl.textContent = 'disconnected';
    statusEl.className = 'pill';
  });
  ws.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      if (Array.isArray(data)) data.forEach(applyFrame);
      else if (data && typeof data === 'object' && 'athleteId' in data) applyFrame(data as AthleteFrame);
    } catch {
      /* ignore malformed */
    }
  });
}

function runSim() {
  sourceEl.textContent = 'simulator';
  srcUri.textContent = '(in-process simulator — no live server)';
  statusEl.textContent = 'simulating';
  statusEl.className = 'pill ok';
  startSimulator(applyFrame, [
    { id: 'A1', name: 'Athlete 1', baseHr: 72, drift: 0.4 },
    { id: 'A2', name: 'Athlete 2', baseHr: 88, drift: 0.7 },
    { id: 'A3', name: 'Athlete 3', baseHr: 105, drift: 1.1 },
    { id: 'A4', name: 'Athlete 4', baseHr: 130, drift: 1.4 },
  ]);
}

if (wsUrl) connectWs(wsUrl);
else runSim();
