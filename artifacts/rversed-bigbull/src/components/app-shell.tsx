import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Boxes, ChevronRight, History, Headphones, Radio, Scale, Sparkles, Download } from 'lucide-react';
import { useInstallPrompt, useIsStandalone } from '@/hooks/use-install-prompt';
import { BrandMark } from '@/components/brand-mark';

const nav = [
  { href: '/gateway', label: 'Live Status', icon: Radio },
  { href: '/bio', label: 'Bio Tool', icon: Boxes },
  { href: '/vip', label: 'VIP Hub', icon: Sparkles },
  { href: '/activity', label: 'Activity', icon: History },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const accessLabel = 'VIP PLAYER';
  return (
    <div className="noise-surface min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[246px] flex-col border-r border-sidebar-border bg-sidebar px-5 py-6 md:flex">
        <BrandMark />
        <div className="text-mono mt-12 px-3 text-[9px] uppercase tracking-[.28em] text-muted-foreground">Control surfaces</div>
        <nav className="mt-4 space-y-1" aria-label="Main navigation">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return <Link key={href} href={href} data-testid={`link-${label.toLowerCase().replace(' ', '-')}`} className={`group flex items-center justify-between border px-3 py-3 text-sm transition ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:border-sidebar-border hover:bg-sidebar-accent hover:text-foreground'}`}>
              <span className="flex items-center gap-3"><Icon size={16} strokeWidth={1.7} /><span>{label}</span></span>
              <ChevronRight size={14} className={active ? 'opacity-100' : 'opacity-0 transition group-hover:opacity-100'} />
            </Link>;
          })}
        </nav>
        <Link href="/support" className={`group mt-3 flex items-center justify-between border px-3 py-3 text-sm text-muted-foreground transition hover:border-sidebar-border hover:bg-sidebar-accent hover:text-foreground ${location === '/support' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-transparent'}`} data-testid="link-support">
          <span className="flex items-center gap-3"><Headphones size={16} strokeWidth={1.7} /><span>Support</span></span>
          <ChevronRight size={14} className={location === '/support' ? 'opacity-100' : 'opacity-0 transition group-hover:opacity-100'} />
        </Link>
        <Link href="/policies" className={`group mt-1 flex items-center justify-between border border-transparent px-3 py-3 text-sm text-muted-foreground transition hover:border-sidebar-border hover:bg-sidebar-accent hover:text-foreground ${location === '/policies' ? 'border-primary/40 bg-primary/10 text-primary' : ''}`} data-testid="link-policies">
          <span className="flex items-center gap-3"><Scale size={16} strokeWidth={1.7} /><span>Policies</span></span>
          <ChevronRight size={14} className={location === '/policies' ? 'opacity-100' : 'opacity-0 transition group-hover:opacity-100'} />
        </Link>
        <div className="mt-auto border-t border-sidebar-border pt-5">
          <div className="sidebar-system-status">
            <span className="sidebar-system-orb" />
            <div><div className="text-mono text-[9px] uppercase tracking-[.12em] text-foreground">24×7 system</div><div className="text-mono text-[9px] uppercase tracking-[.12em] text-accent">online</div></div>
          </div>
          <div className="flex items-center gap-3 px-2">
            <div className="grid h-9 w-9 place-items-center bg-secondary text-display text-lg text-primary">V</div>
            <div className="min-w-0"><div className="truncate text-sm font-semibold" data-testid="text-shell-access">{accessLabel}</div><div className="text-mono text-[9px] uppercase tracking-wider text-accent">Player online</div></div>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-5 py-4 backdrop-blur md:hidden">
        <BrandMark compact />
        <span className="text-mono text-[10px] text-accent">{accessLabel}</span>
        <InstallButton />
      </header>
      <main className="min-h-[100dvh] px-5 py-7 md:ml-[246px] md:px-10 md:py-10 lg:px-14">{children}</main>
    </div>
  );
}

/** Small Install App button shown in the mobile topbar while the site is installable. */
export function InstallButton() {
  const install = useInstallPrompt();
  const standalone = useIsStandalone();
  if (install === null || standalone) return null;
  return (
    <button
      type="button"
      onClick={install}
      data-testid="button-install-app"
      className="flex items-center gap-1.5 border border-primary/40 bg-primary/10 px-3 py-1.5 text-mono text-[10px] uppercase tracking-[.14em] text-primary transition active:bg-primary/20"
    >
      <Download size={12} strokeWidth={1.8} />
      <span>Install App</span>
    </button>
  );
}