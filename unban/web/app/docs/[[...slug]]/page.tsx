import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle, EditOnGitHub, PageLastUpdate } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { REPO } from "@/lib/config";
import { source } from "@/lib/source";
import LAST_UPDATED from "@/content/last-updated.json";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const MDX = page.data.body;
  const path = `web/content/docs/${page.path}`;
  const updated = (LAST_UPDATED as Record<string, string>)[page.path];
  return (
    <DocsPage toc={page.data.toc} full={page.data.full} tableOfContent={{ style: "clerk" }}>
      <div className="flex items-center gap-3">
        <DocsTitle>{page.data.title}</DocsTitle>
        <span className="rounded-[4px] border border-[#8a6a16] px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] text-[var(--amber)]">STUDIO NEXT</span>
      </div>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents, Callout, Card, Cards, Tab, Tabs }} />
      </DocsBody>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        {updated ? <PageLastUpdate date={new Date(updated)} /> : <span />}
        <EditOnGitHub href={`${REPO}/blob/main/${path}`} />
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
