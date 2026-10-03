import { Feed } from '@/components/Feed';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { NewsTicker } from '@/components/NewsTicker';
import { RecentReports } from '@/components/RecentReports';
import { Frame, SiteFooter, SiteNav } from '@/components/SiteNav';
import { getDb } from '@/lib/db/client';
import { listDoneEvents, listEvents } from '@/lib/db/repo';
import { excludeShown } from '@/lib/ui/home';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const db = await getDb();
  const [events, reports] = await Promise.all([listEvents(db, 30), listDoneEvents(db, 6)]);
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
      </SiteNav>
      <NewsTicker events={events} />
      <main className="flex-1">
        <Hero />
        <div className="spectral-line" />
        <HowItWorks />
        <RecentReports events={reports} />
        <Feed events={excludeShown(events, reports)} />
      </main>
      <SiteFooter />
    </Frame>
  );
}
