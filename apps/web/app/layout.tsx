import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "solVPN - Decentralized VPN on Solana",
  description: "Private, secure, and decentralized VPN powered by Solana blockchain",
};

// Force dynamic rendering for all pages
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-black text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}


