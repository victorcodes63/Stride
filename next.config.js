/** @type {import('next').NextConfig} */
const strictBuild = process.env.STRICT_BUILD === 'true';

const nextConfig = {
  transpilePackages: ['shaders'],
  async redirects() {
    return [
      {
        source: '/v3',
        destination: '/',
        permanent: true,
      },
      {
        source: '/dashboard/accounts/contracts',
        destination: '/dashboard/people/contracts',
        permanent: true,
      },
      {
        source: '/dashboard/accounts/contracts/:id',
        destination: '/dashboard/people/contracts/:id',
        permanent: true,
      },
      {
        source: '/ess/leave-approvals',
        destination: '/ess/team/leave',
        permanent: false,
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: !strictBuild,
  },
  typescript: {
    ignoreBuildErrors: !strictBuild,
  },
  images: {
    unoptimized: true
  },
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig
