type PublicAppShellProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export default function PublicAppShell({ children, className = '', style }: PublicAppShellProps) {
  return (
    <div
      className={`public-app min-h-screen bg-pub-surface font-pub ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
