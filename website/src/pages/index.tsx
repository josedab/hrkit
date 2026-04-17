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

const quickExample = `import { SessionRecorder, connectToDevice, MockTransport } from '@hrkit/core';
import { GENERIC_HR } from '@hrkit/core/profiles';

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

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/quick-start">
            Get Started →
          </Link>
          <Link
            className="button button--secondary button--lg"
            style={{marginLeft: '1rem'}}
            to="/demo/">
            Live Demo ▶
          </Link>
          <Link
            className="button button--outline button--lg"
            style={{marginLeft: '1rem', color: '#fff', borderColor: '#fff'}}
            href="https://github.com/hrkit/hrkit">
            GitHub
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
              That's it. <code>@hrkit/core</code> has <strong>zero dependencies</strong>.
              Add a platform adapter when you're ready to connect to real hardware.
            </p>
            <table>
              <thead>
                <tr><th>Platform</th><th>Install</th></tr>
              </thead>
              <tbody>
                <tr><td>React Native</td><td><code>@hrkit/core @hrkit/react-native</code></td></tr>
                <tr><td>Web Browser</td><td><code>@hrkit/core @hrkit/web</code></td></tr>
                <tr><td>Polar ECG/ACC</td><td><code>@hrkit/core @hrkit/polar</code></td></tr>
                <tr><td>Testing / Prototyping</td><td><code>@hrkit/core</code></td></tr>
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

function ComparisonSection() {
  return (
    <section className={styles.installSection} style={{background: 'var(--ifm-color-emphasis-100)'}}>
      <div className="container">
        <Heading as="h2">How it compares</Heading>
        <p>
          Most heart-rate APIs are vertically locked to a single vendor or hide the raw signal behind a
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
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="BLE Heart Rate SDK for TypeScript"
      description="Platform-agnostic TypeScript SDK for BLE heart rate sensors. Works with any BLE HR device. HRV metrics, zones, TRIMP, session recording.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <InstallSection />
        <ComparisonSection />
      </main>
    </Layout>
  );
}
