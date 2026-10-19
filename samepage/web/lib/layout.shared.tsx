import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/site/logo';
import { REPO_URL } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <Logo size={20} /> samepage
        </span>
      ),
      url: '/',
    },
    links: [
      { text: 'Pages', url: '/me' },
      { text: 'Templates', url: '/templates' },
      { text: 'Open a page', url: '/new' },
    ],
    githubUrl: REPO_URL,
  };
}
