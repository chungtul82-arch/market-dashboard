'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/',          label: '📊 시장 대시보드' },
  { href: '/portfolio', label: '💼 포트폴리오'     },
  { href: '/spot',      label: '🔍 스팟 시황'      },
  { href: '/screener',  label: '🎯 주도주 스크리너' },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-12 flex items-center gap-6">
        <span className="text-sm font-bold text-foreground shrink-0">📊 MarketDash</span>
        <div className="flex gap-1 flex-1 overflow-x-auto">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'text-sm px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap',
                  active
                    ? 'bg-[#6366f1]/15 text-[#6366f1] font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
