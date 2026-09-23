import { CreditBanner, CreditPill } from '@/components/CreditBanner';
import { Feed } from '@/components/Feed';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { NewsTicker } from '@/components/NewsTicker';
import { Container, Frame, SiteFooter, SiteNav } from '@/components/SiteNav';
import { getDb } from '@/lib/db/client';
import { listEvents } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const events = await listEvents(await getDb(), 30);
  return (
    <Frame>
      <SiteNav>
        <div className="hidden gap-8 text-sm text-white/70 lg:flex">
          <a href="#cara-kerja" className="hover:text-fg">
            Cara kerja
          </a>
          <a href="#berita" className="hover:text-fg">
            Berita terbaru
          </a>
        </div>
        <CreditPill />
      </SiteNav>
      <NewsTicker events={events} />
      <main className="flex-1">
        <Container className="pt-4 empty:hidden">
          <CreditBanner />
        </Container>
        <Hero />
        <div className="spectral-line" />
        <HowItWorks />
        <Feed events={events} />
      </main>
      <SiteFooter />
    </Frame>
  );
}
