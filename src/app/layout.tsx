import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EKG-Rhythmus-Trainer",
  description: "Webbasierter EKG-Monitor für Reanimationsfortbildungen",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
