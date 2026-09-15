import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingExcludes: { '/*': ['./data/**/*', './.git/**/*', './test/**/*', './docs/**/*'] },
};
export default config;
