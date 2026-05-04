import type { Metadata } from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google';
import { NavBar } from '@/components/layout/NavBar';
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
        <NavBar />
        {children}
      </body>
    </html>
  );
}
