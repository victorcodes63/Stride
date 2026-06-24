import type { Metadata } from 'next';
import TrainingContent from './TrainingContent';

export const metadata: Metadata = {
 title: 'Training & Development | Stride Dashboard',
};

export default function TrainingPage() {
 return <TrainingContent />;
}
