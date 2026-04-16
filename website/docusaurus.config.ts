import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: '@hrkit',
  tagline: 'BLE heart rate data in TypeScript. Any device. Any platform.',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://hrkit.dev',
  baseUrl: '/',

  organizationName: 'hrkit',
  projectName: 'hrkit',

  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/hrkit/hrkit/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: '@hrkit',
      logo: {
        alt: '@hrkit Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/reference/core-api',
          label: 'API',
          position: 'left',
        },
        {
          href: 'https://github.com/hrkit/hrkit',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Quick Start', to: '/docs/getting-started/quick-start'},
            {label: 'API Reference', to: '/docs/reference/core-api'},
          ],
        },
        {
          title: 'Packages',
          items: [
            {label: '@hrkit/core', href: 'https://www.npmjs.com/package/@hrkit/core'},
            {label: '@hrkit/polar', href: 'https://www.npmjs.com/package/@hrkit/polar'},
            {label: '@hrkit/react-native', href: 'https://www.npmjs.com/package/@hrkit/react-native'},
            {label: '@hrkit/web', href: 'https://www.npmjs.com/package/@hrkit/web'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: 'https://github.com/hrkit/hrkit'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} @hrkit contributors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'markup'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
