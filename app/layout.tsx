import type { Metadata } from "next";
import "./globals.css";
import "../frontend/styles/questfit.css";

export const metadata: Metadata = {
  title: "QuestFit — прокачивай себя в реальной жизни",
  description:
    "Фитнес превращается в игру: ежедневные квесты, серии, командные рейды и честный прогресс.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
