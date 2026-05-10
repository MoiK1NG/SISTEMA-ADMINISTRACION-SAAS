import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"

import "./globals.css"
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "Business Portal - SaaS Admin",
  description: "Multi-portal entrepreneurship platform for managing users and memberships",
}

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
}

// ... tus imports arriba
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white antialiased">
        {children}
      </body>
    </html>
  )
}
