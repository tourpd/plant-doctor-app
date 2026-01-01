import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google"; // ✅ 대체 폰트
import "./globals.css";

// ✅ Inter 폰트 (대체 for Geist Sans)
const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// ✅ Roboto Mono (대체 for Geist Mono)
const robotoMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * ✅ 포토닥터 PWA 메타데이터
 */
export const metadata: Metadata = {
  title: "포토닥터",
  description: "사진 한 장으로 당신의 작물을 진단합니다",
  icons: {
    icon: "/logo-photodoctor.png",
    apple: "/logo-photodoctor.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* ✅ PWA 핵심 */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2ecc71" />
        <meta name="application-name" content="포토닥터" />

        {/* ✅ iOS 홈화면 설치 대응 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="포토닥터" />
        <link rel="apple-touch-icon" href="/logo-photodoctor.png" />

        {/* ✅ 기본 파비콘 */}
        <link rel="icon" href="/logo-photodoctor.png" />
      </head>

      <body className={`${inter.variable} ${robotoMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}