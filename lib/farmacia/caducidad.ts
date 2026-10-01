/**
 * Semáforo de caducidad (pedido del cliente):
 *   🟢 verde    — vence en más de 6 meses
 *   🟡 amarillo — vence entre 3 y 6 meses
 *   🔴 rojo     — vence en menos de 3 meses
 *   ⚫ vencido  — ya venció (no debe venderse)
 *
 * Umbral en días para no depender de longitudes de mes: 6 meses ≈ 180 días,
 * 3 meses ≈ 90 días.
 */
export type EstadoCaducidad = "verde" | "amarillo" | "rojo" | "vencido" | "sin_fecha"

export function diasParaVencer(fechaVencimiento: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fin = new Date(fechaVencimiento + "T00:00:00")
  return Math.round((fin.getTime() - hoy.getTime()) / 86_400_000)
}

/**
 * Estado de un lote según su fecha. Un lote existente SIN fecha (carga
 * inicial de inventario) es "sin_fecha": se vende, pero hay que completarla.
 * Devuelve null solo cuando no hay lote (fecha null y sinFecha false).
 */
export function estadoCaducidad(fechaVencimiento: string | null, sinFecha = false): EstadoCaducidad | null {
  if (!fechaVencimiento) return sinFecha ? "sin_fecha" : null
  const d = diasParaVencer(fechaVencimiento)
  if (d < 0)    return "vencido"
  if (d <= 90)  return "rojo"
  if (d <= 180) return "amarillo"
  return "verde"
}

export const CADUCIDAD_META: Record<EstadoCaducidad, { label: string; clases: string; dot: string }> = {
  verde:     { label: "+6 meses",   clases: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  amarillo:  { label: "3–6 meses",  clases: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-400"   },
  rojo:      { label: "Por vencer", clases: "bg-rose-50 text-rose-700 border-rose-200",          dot: "bg-rose-500"    },
  vencido:   { label: "VENCIDO",    clases: "bg-slate-800 text-white border-slate-800",           dot: "bg-slate-900"   },
  sin_fecha: { label: "Sin fecha",  clases: "bg-slate-100 text-slate-500 border-slate-200",       dot: "bg-slate-400"   },
}
