import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist_Mono, Inter } from "next/font/google";
import { isClerkConfigured } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maintainer",
  description: "APIs change. Your codebase shouldn't break.",
};

const clerkAppearance = {
  variables: {
    colorPrimary: "#171717",
    colorForeground: "#171717",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#171717",
    borderRadius: "8px",
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: "shadow-none border border-[#EAEAEA] rounded-[10px]",
    headerTitle: "text-[15px] font-medium",
    headerSubtitle: "text-[14px] text-[#666666]",
    socialButtonsBlockButton: "border border-[#EAEAEA] hover:bg-[#FAFAFA]",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const content = isClerkConfigured() ? (
    <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
  ) : (
    children
  );

  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white font-sans text-foreground">
        {content}
      </body>
    </html>
  );
}
