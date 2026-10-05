/** Inline script to set `dark` class before paint — prevents theme flash on load. */
export function DashboardThemeScript({ forceLight = false }: { forceLight?: boolean }) {
  const script = forceLight
    ? `(function(){try{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';}catch(e){}})();`
    : `(function(){try{var k='hris-dashboard:theme';var t=localStorage.getItem(k);var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
