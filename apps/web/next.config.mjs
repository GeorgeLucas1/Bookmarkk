import path from 'node:path';
import nextEnv from '@next/env';

// Load the monorepo root .env so NEXT_PUBLIC_* values are shared with the API.
nextEnv.loadEnvConfig(path.resolve(process.cwd(), '../..'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
