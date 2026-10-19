import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'samepage';
export const docsRoute = '/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'meitipro',
  repo: 'genlayer-arcade',
  branch: 'claude/project-deploy-test-t7j87s',
  dir: 'samepage',
};

export const REPO_URL = `https://github.com/${gitConfig.user}/${gitConfig.repo}/tree/${gitConfig.branch}/${gitConfig.dir}`;
export const editUrl = (path: string) =>
  `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/${gitConfig.dir}/${path}`;

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md'];
  return { segments, url: getContentUrl(segments, page.locale) };
}
