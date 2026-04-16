import { HRKitHeartRate } from './heart-rate.js';
import { HRKitZoneBar } from './zone-bar.js';
import { HRKitHRChart } from './hr-chart.js';

export { HRKitHeartRate } from './heart-rate.js';
export { HRKitZoneBar } from './zone-bar.js';
export { HRKitHRChart } from './hr-chart.js';
export { ZONE_COLORS, hrToColor, hrToZone } from './colors.js';

export function registerAll(): void {
  if (!customElements.get('hrkit-heart-rate')) {
    customElements.define('hrkit-heart-rate', HRKitHeartRate);
  }
  if (!customElements.get('hrkit-zone-bar')) {
    customElements.define('hrkit-zone-bar', HRKitZoneBar);
  }
  if (!customElements.get('hrkit-hr-chart')) {
    customElements.define('hrkit-hr-chart', HRKitHRChart);
  }
}

// Auto-register when imported
registerAll();
