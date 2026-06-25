import type { Metadata } from 'next';
import GovernanceContent from './GovernanceContent';

export const metadata: Metadata = {
  title: 'Board & governance | Stride Dashboard',
  description: 'Meeting minutes, resolutions, and board action tracking.',
};

export default function GovernancePage() {
  return <GovernanceContent />;
}
