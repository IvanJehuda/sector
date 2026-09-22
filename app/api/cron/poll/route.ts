import { pollFromEnv } from '@/lib/pipeline/from-env';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return Response.json(await pollFromEnv());
}
