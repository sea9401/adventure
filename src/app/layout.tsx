import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "방치형 RPG", template: "%s | 방치형 RPG" },
  description:
    "텍스트 기반의 한국어 방치형 RPG. 직업을 정해 탐험을 보내고, 보스를 처치하며 영구 진행이 누적되는 가벼운 웹 게임.",
  keywords: ["방치형 RPG", "텍스트 RPG", "한국어 게임", "웹 RPG", "idle game"],
  openGraph: {
    type: "website",
    siteName: "방치형 RPG",
    title: "방치형 RPG",
    description: "텍스트 기반의 한국어 방치형 RPG. 직업·탐험·보스·영지·도감으로 천천히 강해지세요.",
    locale: "ko_KR",
  },
  twitter: { card: "summary_large_image", title: "방치형 RPG" },
  icons: { icon: "/favicon.ico" },
  robots: { index: true, follow: true },
};

// 모바일 — 노치/홈 인디케이터 영역까지 컨텐츠를 채우도록 viewport-fit=cover.
// safe-area-inset-* env() 값이 활성화됨 (globals.css 에서 사용).
// themeColor: 다크 베이스(canvas zinc-950)에 맞춤 — 모바일 브라우저 상단 바 색상 통일.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
