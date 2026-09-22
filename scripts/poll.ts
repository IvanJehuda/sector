import './env';
import { pollFromEnv } from '@/lib/pipeline/from-env';

pollFromEnv()
  .then((result) => {
    console.log(result.skipped ? `Polling dilewati (${result.skipped}).` : `Berita baru: ${result.inserted} (sejak ${result.start}).`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
