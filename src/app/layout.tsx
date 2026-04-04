import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import MainHeader from "@/components/layout/MainHeader";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KOLEEX — Enterprise Platform",
  description: "Koleex ERP — Manage products, operations, and more",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23000'/><text x='16' y='22' text-anchor='middle' fill='white' font-family='Helvetica' font-weight='700' font-size='16'>K</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0A0A0A] text-white font-sans">
        <MainHeader />
        <div className="pt-14 flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </body>
    </html>
  );
}
