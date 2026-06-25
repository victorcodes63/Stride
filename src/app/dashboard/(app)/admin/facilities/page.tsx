import type { Metadata } from 'next';
import FacilitiesContent from './FacilitiesContent';

export const metadata: Metadata = {
  title: 'Facilities | Stride Dashboard',
  description: 'Sites, leases, and maintenance tickets.',
};

export default function FacilitiesPage() {
  return <FacilitiesContent />;
}
