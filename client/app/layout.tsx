import type { Metadata } from "next";
import Navbar from "./_components/navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drip | AI powered water creation",
  description: "AI compute that turns workload heat into clean water.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
