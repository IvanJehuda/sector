import { AnalyzeForm } from '@/components/AnalyzeForm';
import { CreditBanner } from '@/components/CreditBanner';
import { Feed } from '@/components/Feed';
import { getDb } from '@/lib/db/client';
import { listEvents } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const events = await listEvents(await getDb(), 30);
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Correlation Explainer</h1>
        <p className="text-gray-600">Dari berita ke saham IDX yang terkait, lengkap dengan bukti data Sectors.</p>
      </header>
      <CreditBanner />
      <AnalyzeForm />
      <Feed events={events} />
    </main>
  );
}
