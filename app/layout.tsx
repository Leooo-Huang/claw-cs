import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { GlobalNotification } from "@/components/layout/global-notification";

export const metadata: Metadata = {
  title: "智能客服 - IntelliCave",
  description: "基于 OpenClaw 的自进化智能客服系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-slate-50 font-sans">
        <div className="flex h-screen">
          <Sidebar />
          {/* Main content area — offset by sidebar width */}
          <main className="flex-1 ml-60 h-screen overflow-y-auto">
            {children}
          </main>
        </div>
        <GlobalNotification />
      </body>
    </html>
  );
}
