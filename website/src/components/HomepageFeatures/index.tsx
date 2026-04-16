import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Any BLE Heart Rate Sensor',
    icon: '📡',
    description: (
      <>
        Works with Polar, Garmin, Wahoo, Magene, and any device that implements
        the standard BLE Heart Rate profile. Not locked to a single brand.
      </>
    ),
  },
  {
    title: 'Platform Agnostic',
    icon: '🔌',
    description: (
      <>
        BLE transport is injected via an interface. Ship adapters for React Native,
        Web Bluetooth, or any runtime. The core has zero dependencies.
      </>
    ),
  },
  {
    title: 'Real Metrics, Not Toys',
    icon: '📊',
    description: (
      <>
        RMSSD, SDNN, pNN50, 5-zone HR model, Bannister TRIMP, readiness verdicts,
        artifact filtering, and session recording — all as pure, tested functions.
      </>
    ),
  },
  {
    title: 'Polar PMD Protocol',
    icon: '🫀',
    description: (
      <>
        Unlock raw 130Hz ECG and accelerometer streaming on Polar H10, H9, OH1,
        and Verity Sense with the optional <code>@hrkit/polar</code> package.
      </>
    ),
  },
  {
    title: 'No Hardware Required',
    icon: '🧪',
    description: (
      <>
        <code>MockTransport</code> replays in-memory data for testing and prototyping.
        Build your entire app before touching a real sensor.
      </>
    ),
  },
  {
    title: 'TypeScript First',
    icon: '🛡️',
    description: (
      <>
        Full type safety from BLE bytes to session analytics. Every function, every
        interface, every config object is typed and documented.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md" style={{marginBottom: '2rem'}}>
        <div style={{fontSize: '3rem', marginBottom: '0.5rem'}}>{icon}</div>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
