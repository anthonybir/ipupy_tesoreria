import type { JSX } from 'react';
import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

import { Providers } from "./providers";
import AppLayout from "@/components/Layout/AppLayout";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "IPU PY Tesorería",
  description: "Sistema de Tesorería Nacional - Iglesia Pentecostal Unida del Paraguay",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${plusJakarta.variable} antialiased`}>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
