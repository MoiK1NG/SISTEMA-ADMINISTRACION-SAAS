import type { Metadata, Viewport } from "next"
import { Poppins } from "next/font/google"

import "./globals.css"
import { cn } from "@/lib/utils"

// Poppins es la única tipografía de marca de LOMS 360 (manual, lámina 18)
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default:  "LOMS 360 · La solución 360 para tu negocio",
    template: "%s · LOMS 360",
  },
  description: "CRM y ERP en una sola plataforma: clientes, ventas, inventario y finanzas, todo conectado y en tiempo real.",
  applicationName: "LOMS 360",
}

export const viewport: Viewport = {
  themeColor: "#042C53",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={cn("font-sans", poppins.variable)}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
