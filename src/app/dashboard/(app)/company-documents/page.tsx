import type { Metadata } from 'next';
import CompanyDocumentsContent from './CompanyDocumentsContent';

export const metadata: Metadata = {
 title: 'Company Documents | Stride Dashboard',
};

export default function CompanyDocumentsPage() {
 return <CompanyDocumentsContent />;
}
