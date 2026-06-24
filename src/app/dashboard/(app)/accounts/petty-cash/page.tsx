import type { Metadata } from 'next';
import PettyCashContent from './PettyCashContent';

export const metadata: Metadata = {
 title: 'Petty Cash | Stride (Finance)',
};

export default function PettyCashPage() {
 return <PettyCashContent />;
}
