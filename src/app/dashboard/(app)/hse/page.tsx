import type { Metadata } from 'next';
import HseIncidentsContent from './HseIncidentsContent';

export const metadata: Metadata = {
  title: 'HSE & incidents | Stride Dashboard',
  description: 'Log, investigate, and resolve workplace safety incidents.',
};

export default function HseIncidentsPage() {
  return <HseIncidentsContent />;
}
