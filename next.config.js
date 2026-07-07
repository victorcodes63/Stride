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
        source: '/dashboard/outsourcing/employees',
        destination: '/dashboard/employees',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/employees/new',
        destination: '/dashboard/employees/new',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/employees/:id/edit',
        destination: '/dashboard/employees/:id/edit',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/departments',
        destination: '/dashboard/departments',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/attendance',
        destination: '/dashboard/attendance',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/leave',
        destination: '/dashboard/leave?audience=employees',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/disciplinary',
        destination: '/dashboard/disciplinary',
        permanent: false,
      },
      {
        source: '/dashboard/accounts/payroll',
        destination: '/dashboard/outsourcing/payroll',
        permanent: false,
      },
      {
        source: '/dashboard/accounts/payroll/payslips',
        destination: '/dashboard/outsourcing/payroll/payslips',
        permanent: false,
      },
      {
        source: '/dashboard/payroll',
        destination: '/dashboard/outsourcing/payroll',
        permanent: false,
      },
      {
        source: '/dashboard/payroll/payslips',
        destination: '/dashboard/outsourcing/payroll/payslips',
        permanent: false,
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
