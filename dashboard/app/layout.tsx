import type { Metadata } from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'], weight: ['400', '500', '700'],
  variable: '--font-noto', display: 'swap',
});

export const metadata: Metadata = {
  title: '한국 섹터 히트맵 대시보드',
  description: '한국 증시 섹터 ETF 수익률·상대강도 실시간 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className={`${inter.variable} ${notoSansKR.variable}`}>
        {/* 상단 네비게이션 */}
        <nav className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-12 flex items-center gap-6">
            <span className="text-sm font-bold text-foreground">📊 MarketDash</span>
            <div className="flex gap-4">
              <Link href="/"          className="text-sm text-muted-foreground hover:text-foreground transition-colors">섹터 히트맵</Link>
              <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">내 포트폴리오</Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
