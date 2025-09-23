import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "./providers";
import AppLayout from "@/components/Layout/AppLayout";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "IPU PY Tesorería",
  description: "Sistema de Tesorería Nacional - Iglesia Pentecostal Unida del Paraguay",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
