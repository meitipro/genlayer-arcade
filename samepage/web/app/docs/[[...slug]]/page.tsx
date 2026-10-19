import { source } from '@/lib/source';
import { DocsBody, DocsDescription, DocsPage, DocsTitle, EditOnGitHub, MarkdownCopyButton, PageLastUpdate } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { editUrl, getPageMarkdownUrl } from '@/lib/shared';
import meta from '@/lib/doc-meta.json';

type Meta = Record<string, { updated: string; source: string }>;

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  const info = (meta as Meta)[page.path];

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-3 items-center border-b pb-6 flex-wrap" style={{ fontSize: 13.5 }}>
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <span className="pill"><span className="dot" /> Studio Next</span>
      </div>
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
      <div className="flex flex-row gap-4 items-center flex-wrap" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <EditOnGitHub href={editUrl(info?.source ?? page.path)} />
        {info?.updated ? <PageLastUpdate date={new Date(info.updated)} /> : null}
      </div>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
