export default function AccountsModulePlaceholder({
  title,
  summary,
}: {
  title: string;
  summary: string;
}) {
  return (
    <div className="w-full min-w-0">
      <h1 className="text-2xl font-bold text-primary-900 tracking-tight">{title}</h1>
      <p className="mt-3 text-neutral-600 text-sm leading-relaxed">{summary}</p>
    </div>
  );
}
