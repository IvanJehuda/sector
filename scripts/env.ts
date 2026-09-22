import { existsSync } from 'node:fs';

// Loads .env.local for tsx scripts. Variables already set in the shell take precedence.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
