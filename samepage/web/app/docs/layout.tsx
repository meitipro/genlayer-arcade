import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      sidebar={{
        banner: (
          <span className="pill" title="Every address and transaction in these docs is on GenLayer Studio Next, chain 61997">
            <span className="dot" /> Studio Next · chain 61997
          </span>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
