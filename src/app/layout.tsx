import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ByeMatt",
  description: "Catch Matt off guard. He drinks.",
  // Next links the manifest from src/app/manifest.ts automatically. This is the
  // rest of the home-screen kit: iOS reads `appleWebApp` and the touch icon
  // rather than the manifest, and it's iOS that gates push on being installed.
  applicationName: "ByeMatt",
  appleWebApp: { capable: true, title: "ByeMatt", statusBarStyle: "black" },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        {children}
      </body>
    </html>
  );
}
