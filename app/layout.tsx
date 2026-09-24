import type { Metadata } from 'next';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrivateOps | Privacy Preserving Authorization',
  description:
    'Verify what AI agents are allowed to do without exposing private rules.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}