import type { Config } from '@docusaurus/types';

const config: Config = {
  title: 'OpenSilver',
  tagline: 'Security-by-construction covenant patterns for SilverScript',
  url: 'https://opensilver.dev',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'trillskillz',
  projectName: 'OpenSilver',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn'
    }
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts'
        },
        blog: false,
        theme: {
          customCss: undefined
        }
      }
    ]
  ],
  themeConfig: {
    navbar: {
      title: 'OpenSilver',
      items: [
        { to: '/docs/intro', label: 'Docs', position: 'left' },
        { href: 'https://github.com/trillskillz/OpenSilver', label: 'GitHub', position: 'right' }
      ]
    }
  }
};

export default config;
