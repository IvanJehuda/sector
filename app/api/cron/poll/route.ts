import { isCronAuthorized } from '@/lib/cron/auth';
import { pollFromEnv } from '@/lib/pipeline/from-env';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  if (!isCronAuthorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return Response.json(await pollFromEnv());
}
