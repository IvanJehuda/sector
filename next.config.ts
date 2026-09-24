import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client', 'libsql'],
  // Fixtures are read via a runtime path (lib/sectors/from-env.ts), so file tracing can't see them.
  outputFileTracingIncludes: { '/**': ['./fixtures/sectors/**/*'] },
};

export default nextConfig;
