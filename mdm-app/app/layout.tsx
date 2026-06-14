import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MDM Express — Confirmation Analyzer",
  description:
    "Internal tool: diagnose merchant order-confirmation performance and recommend fixes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
