import { after } from 'next/server';
import { z } from 'zod';
import { insertEvent } from '@/lib/db/repo';
import { todayWib } from '@/lib/domain';
import { ArticleFetchError } from '@/lib/events/article';
import { buildManualEvent, InputError } from '@/lib/events/manual';
import { analyzeEvent } from '@/lib/pipeline/analyze';
import { pipelineFromEnv } from '@/lib/pipeline/from-env';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  url: z.string().url().optional(),
  text: z.string().optional(),
  title: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eventId: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Input tidak valid.' }, { status: 400 });

  const deps = await pipelineFromEnv();
  let eventId = parsed.data.eventId;
  if (!eventId) {
    try {
      const input = await buildManualEvent(parsed.data, todayWib());
      eventId = (await insertEvent(deps.db, input)).event.id;
    } catch (err) {
      if (err instanceof InputError || err instanceof ArticleFetchError) {
        return Response.json({ error: err.message, needText: true }, { status: 422 });
      }
      throw err;
    }
  }

  const id = eventId;
  after(async () => {
    try {
      await analyzeEvent(id, deps);
    } catch (err) {
      console.error('analyzeEvent failed', id, err);
    }
  });
  return Response.json({ eventId: id }, { status: 202 });
}
