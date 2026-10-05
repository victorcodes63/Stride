import type { ComponentProps } from 'react';
import { EditorialSectionHead } from '@/components/marketing/editorial/EditorialSectionHead';

/** /platform has six indexed sections. */
export function PlatformSectionHead(props: Omit<ComponentProps<typeof EditorialSectionHead>, 'total'>) {
  return <EditorialSectionHead {...props} total={6} />;
}
