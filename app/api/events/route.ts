import { getDb } from '@/lib/db/client';
import { listEvents } from '@/lib/db/repo';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ events: await listEvents(await getDb(), 50) });
}
