import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GridMind — Rahul R",
  description: "European Energy Trading Intelligence Platform — XGBoost Forecasting | R² 0.9619 | Cohere AI",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
