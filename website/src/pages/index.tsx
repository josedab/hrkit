import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';

import styles from './index.module.css';

const installSnippet = `npm install @hrkit/core`;

const quickExample = `import { SessionRecorder, connectToDevice, MockTransport, GENERIC_HR } from '@hrkit/core';

const transport = new MockTransport({
  device: { id: 'demo', name: 'Mock HR Strap' },
  packets: [
    { timestamp: 0,    hr: 72, rrIntervals: [833], contactDetected: true },
    { timestamp: 1000, hr: 78, rrIntervals: [769], contactDetected: true },
    { timestamp: 2000, hr: 85, rrIntervals: [706], contactDetected: true },
  ],
});

const conn = await connectToDevice(transport, { prefer: [GENERIC_HR] });
const recorder = new SessionRecorder({ maxHR: 185, restHR: 48 });

for await (const packet of conn.heartRate()) {
  recorder.ingest(packet);
}

const session = recorder.end();
console.log(\`Recorded \${session.samples.length} samples\`);`;

const metricsExample = `import { analyzeSession, rmssd, fitnessScore, estimateVO2maxUth } from '@hrkit/core';

// One-call session analysis
const analysis = analyzeSession(session);
console.log(\`TRIMP: \${analysis.trimp}, Zone 4: \${analysis.zones.zones[4]}s\`);
console.log(\`RMSSD: \${analysis.hrv?.rmssd}ms, SDNN: \${analysis.hrv?.sdnn}ms\`);

// VO2max estimation from resting HR
const vo2 = estimateVO2maxUth(185, 55);
const fitness = fitnessScore(vo2.vo2max, 30, 'male');
console.log(\`VO2max: \${vo2.vo2max} → \${fitness.category} (\${fitness.percentile}th %ile)\`);`;

function Badges() {
  return (
    <div className={styles.badges}>
      <a href="https://github.com/josedab/hrkit/actions/workflows/ci.yml"><img src="https://github.com/josedab/hrkit/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
      {' '}
      <a href="https://codecov.io/gh/josedab/hrkit"><img src="https://codecov.io/gh/josedab/hrkit/branch/main/graph/badge.svg" alt="codecov" /></a>
      {' '}
      <img src="https://img.shields.io/badge/TypeScript-5.4+-blue.svg" alt="TypeScript" />
      {' '}
      <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" />
      {' '}
      <img src="https://img.shields.io/badge/dependencies-0-brightgreen.svg" alt="zero deps" />
    </div>
  );
}

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <Badges />
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/quick-start">
            Get Started →
          </Link>
          <Link
            className="button button--outline button--lg"
            style={{marginLeft: '1rem', color: '#fff', borderColor: '#fff'}}
            href="https://github.com/josedab/hrkit">
            GitHub ⭐
          </Link>
        </div>
      </div>
    </header>
  );
}

function InstallSection() {
  return (
    <section className={styles.installSection}>
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <Heading as="h2">Install in seconds</Heading>
            <CodeBlock language="bash">{installSnippet}</CodeBlock>
            <p style={{marginTop: '1rem'}}>
              <code>@hrkit/core</code> has <strong>zero runtime dependencies</strong>.
              Add a platform adapter when you're ready for real hardware.
            </p>
            <table>
              <thead>
                <tr><th>Platform</th><th>Install</th></tr>
              </thead>
              <tbody>
                <tr><td>React Native</td><td><code>@hrkit/core @hrkit/react-native</code></td></tr>
                <tr><td>Web Browser</td><td><code>@hrkit/core @hrkit/web</code></td></tr>
                <tr><td>Capacitor</td><td><code>@hrkit/core @hrkit/capacitor</code></td></tr>
                <tr><td>Polar ECG/ACC</td><td><code>@hrkit/core @hrkit/polar</code></td></tr>
                <tr><td>Testing</td><td><code>@hrkit/core</code> (includes MockTransport)</td></tr>
              </tbody>
            </table>
          </div>
          <div className="col col--6">
            <Heading as="h2">Try without hardware</Heading>
            <CodeBlock language="typescript" title="demo.ts">{quickExample}</CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section className={styles.installSection} style={{background: 'var(--ifm-color-emphasis-100)'}}>
      <div className="container">
        <div className="row">
          <div className="col col--5">
            <Heading as="h2">How it works</Heading>
            <p>
              BLE transport is <strong>injected</strong> — the core runs on any runtime.
              Platform adapters implement the <code>BLETransport</code> interface.
              The runtime data flow is:
            </p>
            <ol>
              <li>A <strong>BLE adapter</strong> scans and connects to a device</li>
              <li><code>connectToDevice()</code> returns an <strong>HRConnection</strong></li>
              <li>The connection emits <strong>HRPacket</strong> objects via async iterable</li>
              <li><strong>SessionRecorder</strong> ingests packets and tracks state</li>
              <li><code>recorder.end()</code> produces a <strong>Session</strong></li>
              <li>Pure <strong>metric functions</strong> analyze the session data</li>
            </ol>
            <p>
              <Link to="/docs/core-concepts/architecture">
                Read the full architecture guide →
              </Link>
            </p>
          </div>
          <div className="col col--7">
            <Heading as="h2">Analyze everything</Heading>
            <CodeBlock language="typescript" title="analyze.ts">{metricsExample}</CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuiltForSection() {
  const useCases = [
    { icon: '🏋️', title: 'Fitness Apps', desc: 'Session recording, zone tracking, TRIMP, workout protocols with Tabata/EMOM/intervals.' },
    { icon: '🥋', title: 'Combat Sports', desc: 'Round-based recording, group sessions with leaderboards, rolling intensity tracking.' },
    { icon: '🏥', title: 'Health Monitoring', desc: 'HRV trends, readiness verdicts, stress scoring, AFib screening, VO₂max estimation.' },
    { icon: '🚴', title: 'Multi-Sport', desc: 'Cycling power, cadence, running metrics, SpO₂, multi-device fusion from any sensor.' },
    { icon: '📊', title: 'Research & Coaching', desc: 'Advanced HRV (Poincaré, DFA α1, LF/HF), training load analytics (ACWR, TSB).' },
    { icon: '🌐', title: 'Live Dashboards', desc: 'WebSocket/SSE streaming, Web Component widgets, real-time group session heatmaps.' },
  ];

  return (
    <section className={styles.installSection}>
      <div className="container">
        <Heading as="h2" style={{textAlign: 'center', marginBottom: '2rem'}}>Built for</Heading>
        <div className="row">
          {useCases.map(({icon, title, desc}) => (
            <div key={title} className="col col--4" style={{marginBottom: '1.5rem'}}>
              <div style={{fontSize: '2rem', marginBottom: '0.25rem'}}>{icon}</div>
              <Heading as="h3" style={{fontSize: '1.1rem'}}>{title}</Heading>
              <p style={{fontSize: '0.9rem', opacity: 0.85}}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section className={styles.installSection} style={{background: 'var(--ifm-color-emphasis-100)'}}>
      <div className="container">
        <Heading as="h2">How it compares</Heading>
        <p>
          Most heart-rate APIs are locked to a single vendor or hide the raw signal behind a
          cloud subscription. <code>@hrkit</code> is the open, embeddable layer underneath your app.
        </p>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>@hrkit</th>
              <th>Terra API</th>
              <th>Sahha</th>
              <th>Polar SDK</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Open source (MIT)</td><td>✅</td><td>—</td><td>—</td><td>partial</td></tr>
            <tr><td>Works offline / on-device</td><td>✅</td><td>—</td><td>—</td><td>✅</td></tr>
            <tr><td>Vendor-neutral GATT (any HR strap)</td><td>✅</td><td>via cloud</td><td>via cloud</td><td>—</td></tr>
            <tr><td>Raw RR + ECG + IBI access</td><td>✅</td><td>limited</td><td>—</td><td>✅</td></tr>
            <tr><td>HRV / zones / TRIMP built-in</td><td>✅</td><td>—</td><td>partial</td><td>—</td></tr>
            <tr><td>TypeScript-first, zero-dep core</td><td>✅</td><td>—</td><td>—</td><td>—</td></tr>
            <tr><td>React Native + Web + Capacitor</td><td>✅</td><td>via SDKs</td><td>via SDKs</td><td>iOS/Android only</td></tr>
          </tbody>
        </table>
        <p style={{marginTop: '1rem'}}>
          <Link to="/docs/comparison">
            See the full comparison →
          </Link>
        </p>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="BLE Heart Rate SDK for TypeScript"
      description="Platform-agnostic TypeScript SDK for BLE heart rate sensors. Works with any BLE HR device. HRV metrics, zones, TRIMP, session recording, VO2max, stress scoring. Zero dependencies.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <InstallSection />
        <ArchitectureSection />
        <BuiltForSection />
        <ComparisonSection />
      </main>
    </Layout>
  );
}
