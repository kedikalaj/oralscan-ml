import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OralScan",
  description: "Vlerësim i rrezikut për lezionet orale nga fotografia intraorale dhe biomarkerët e pështymës.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FFFFFF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq">
      <body>{children}</body>
    </html>
  );
}
