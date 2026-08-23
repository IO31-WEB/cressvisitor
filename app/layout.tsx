import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRESSOLUTIONS — Location Intelligence",
  description: "Geofenced visit analytics and observed trade area for commercial real estate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
