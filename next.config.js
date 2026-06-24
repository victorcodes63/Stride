/** @type {import('next').NextConfig} */
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
        destination: '/dashboard/leave',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/payroll',
        destination: '/dashboard/payroll',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/payroll/payslips',
        destination: '/dashboard/payroll/payslips',
        permanent: false,
      },
      {
        source: '/dashboard/accounts/payroll',
        destination: '/dashboard/payroll',
        permanent: false,
      },
      {
        source: '/dashboard/accounts/payroll/payslips',
        destination: '/dashboard/payroll/payslips',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/clients',
        destination: '/dashboard/employees',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/clients/new',
        destination: '/dashboard/employees',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/clients/:id',
        destination: '/dashboard/employees',
        permanent: false,
      },
      {
        source: '/dashboard/outsourcing/clients/:id/edit',
        destination: '/dashboard/settings',
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
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true
  },
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig
