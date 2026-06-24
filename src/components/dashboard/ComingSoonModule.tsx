import type { LucideIcon } from 'lucide-react';

type ComingSoonModuleProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export default function ComingSoonModule({ icon: Icon, title, description }: ComingSoonModuleProps) {
  return (
    <div className="w-full min-w-0 py-16">
      <div className="mx-auto max-w-2xl dashboard-surface px-6 py-16 text-center shadow-sm">
        <Icon className="mx-auto mb-4 h-12 w-12 text-neutral-400" />
        <h1 className="mb-2 text-base font-medium text-neutral-900">{title}</h1>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
    </div>
  );
}
