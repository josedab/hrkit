import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/quick-start',
        'getting-started/installation',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      collapsed: false,
      items: [
        'core-concepts/architecture',
        'core-concepts/device-profiles',
        'core-concepts/session-recording',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/hrv-metrics',
        'guides/zones-and-trimp',
        'guides/polar-devices',
        'guides/react-native',
        'guides/web-bluetooth',
        'guides/custom-transport',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'reference/core-api',
        'reference/polar-api',
        'reference/device-compatibility',
      ],
    },
    'faq',
  ],
};

export default sidebars;
