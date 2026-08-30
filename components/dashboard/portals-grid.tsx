"use client"

import Link from "next/link"
import {
  Grid3X3, Building, Calculator, Users, Package,
  Contact, Briefcase, ShoppingCart, FileText, Settings,
  Globe, ArrowRight, Sparkles,
  Croissant, Dumbbell, Landmark, Banknote, UtensilsCrossed, Store, Pill,
} from "lucide-react"
import type { Portal } from "@/lib/types"

interface PortalsGridProps {
  portals: Portal[]
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  building:       Building,
  calculator:     Calculator,
  users:          Users,
  package:        Package,
  contact:        Contact,
  briefcase:      Briefcase,
  "shopping-cart": ShoppingCart,
  "file-text":    FileText,
  settings:       Settings,
  globe:          Globe,
  // Rubros del negocio
  croissant:      Croissant,        // panadería
  dumbbell:       Dumbbell,         // canchas sintéticas
  landmark:       Landmark,         // préstamos
  banknote:       Banknote,         // cobros
  utensils:       UtensilsCrossed,  // restaurante
  store:          Store,            // punto de venta
  pill:           Pill,             // farmacia
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "59, 130, 246"
}

export function PortalsGrid({ portals }: PortalsGridProps) {
  if (portals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-20 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-5">
          <Grid3X3 className="h-7 w-7 text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">Sin portales asignados</h3>
        <p className="mt-2 text-sm text-slate-500 max-w-xs">
          Aún no tienes acceso a ningún portal. Contacta a tu administrador.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {portals.map((portal) => {
        const IconComponent = ICON_MAP[portal.icon || "building"] || Grid3X3
        const color   = portal.color || "#3b82f6"
        const rgb     = hexToRgb(color)

        // Internal URL: starts with "/" or has no protocol
        const href = portal.url
          ? portal.url.startsWith("/") || !portal.url.includes("://")
            ? portal.url
            : portal.url
          : `/portal/${portal.slug}`

        const isExternal = portal.url ? portal.url.includes("://") : false

        return (
          <div
            key={portal.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 transition-all duration-200"
          >
            {/* Header con gradiente del color del portal */}
            <div
              className="relative px-5 pt-6 pb-8"
              style={{
                background: `linear-gradient(135deg, rgba(${rgb},0.12) 0%, rgba(${rgb},0.04) 100%)`,
                borderBottom: `1px solid rgba(${rgb},0.1)`,
              }}
            >
              {/* Círculo decorativo */}
              <div
                className="absolute right-4 top-4 h-16 w-16 rounded-full opacity-10"
                style={{ backgroundColor: color }}
              />

              {/* Icono */}
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl mb-3 group-hover:scale-105 transition-transform"
                style={{ backgroundColor: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.2)` }}
              >
                <IconComponent className="h-6 w-6" style={{ color }} />
              </div>

              <h3 className="text-base font-bold text-slate-900 leading-tight">{portal.name}</h3>
            </div>

            {/* Cuerpo */}
            <div className="flex flex-1 flex-col justify-between p-5 pt-4 gap-4">
              <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                {portal.description || "Portal empresarial · Accede a tus herramientas"}
              </p>

              {/* CTA */}
              {href ? (
                <Link
                  href={href}
                  {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group/btn flex items-center justify-between w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: `rgba(${rgb},0.08)`,
                    color,
                    border: `1px solid rgba(${rgb},0.15)`,
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.backgroundColor = `rgba(${rgb},0.15)`
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.backgroundColor = `rgba(${rgb},0.08)`
                  }}
                >
                  <span>Abrir portal</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                </Link>
              ) : (
                <div className="flex items-center justify-center w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 bg-slate-50 border border-slate-100 cursor-not-allowed">
                  <Sparkles className="h-3.5 w-3.5 mr-2" />
                  Próximamente
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
