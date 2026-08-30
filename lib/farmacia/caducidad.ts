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
export type EstadoCaducidad = "verde" | "amarillo" | "rojo" | "vencido"

export function diasParaVencer(fechaVencimiento: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const fin = new Date(fechaVencimiento + "T00:00:00")
  return Math.round((fin.getTime() - hoy.getTime()) / 86_400_000)
}

export function estadoCaducidad(fechaVencimiento: string | null): EstadoCaducidad | null {
  if (!fechaVencimiento) return null
  const d = diasParaVencer(fechaVencimiento)
  if (d < 0)    return "vencido"
  if (d <= 90)  return "rojo"
  if (d <= 180) return "amarillo"
  return "verde"
}

export const CADUCIDAD_META: Record<EstadoCaducidad, { label: string; clases: string; dot: string }> = {
  verde:    { label: "+6 meses",  clases: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  amarillo: { label: "3–6 meses", clases: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-400"   },
  rojo:     { label: "Por vencer", clases: "bg-rose-50 text-rose-700 border-rose-200",         dot: "bg-rose-500"    },
  vencido:  { label: "VENCIDO",   clases: "bg-slate-800 text-white border-slate-800",          dot: "bg-slate-900"   },
}
