import type { Metadata } from 'next';
import SalesForecastContent from './SalesForecastContent';

export const metadata: Metadata = {
  title: 'Sales forecast | Stride Dashboard',
};

export default function SalesForecastPage() {
  return <SalesForecastContent />;
}
