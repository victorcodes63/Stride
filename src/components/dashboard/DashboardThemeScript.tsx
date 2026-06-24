/** Inline script to set `dark` class before paint — prevents theme flash on load. */
export function DashboardThemeScript() {
  const script = `(function(){try{var k='hris-dashboard:theme';var t=localStorage.getItem(k);var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
