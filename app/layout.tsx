import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pal Opt — AI検索最適化 (AIO)',
  description: 'ChatGPT・Gemini・Google AI検索での見え方を観測し、AIに選ばれる状態を作るAIO×SEO×MEO統合サービス',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
