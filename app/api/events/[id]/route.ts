import { getDb } from '@/lib/db/client';
import { getEvent, getReport } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const db = await getDb();
  const event = await getEvent(db, id);
  if (!event) return Response.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
  return Response.json({ event, report: await getReport(db, id) });
}
