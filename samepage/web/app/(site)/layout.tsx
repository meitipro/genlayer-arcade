import { Nav } from '@/components/site/nav';
import { Footer } from '@/components/site/footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </>
  );
}
