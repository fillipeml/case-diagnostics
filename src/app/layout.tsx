import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  applicationName: "Case Diagnostics",
  title: {
    default: "Case Diagnostics",
    template: "%s · Case Diagnostics",
  },
  description:
    "Strategic diagnosis of a Brazilian civil case file: complexity, risk of the current defence, " +
    "theses not explored and replicable improvements, verified against the file by grounding rules.",
};

export const viewport: Viewport = { themeColor: "#d97706" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${jetbrains.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
