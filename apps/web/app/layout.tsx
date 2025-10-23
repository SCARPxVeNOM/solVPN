import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "solVPN - Decentralized VPN on Solana",
  description: "Private, secure, and decentralized VPN powered by Solana blockchain",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-black text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}


