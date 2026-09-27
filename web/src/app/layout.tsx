import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Content Transformation Engine",
  description: "Turn multimodal source material into strategic content."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
