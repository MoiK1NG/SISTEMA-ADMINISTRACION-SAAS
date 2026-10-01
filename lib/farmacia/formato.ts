/**
 * Formateadores del portal de farmacia, por moneda del negocio.
 *
 * LOMS 360 es colombiana (COP) pero la primera farmacia es chilena (CLP), así
 * que la moneda y el formato de fechas se resuelven por negocio. Cada juego de
 * Intl.*Format se crea una sola vez por moneda: crearlos es caro y las tablas
 * los usaban una vez por celda.
 */

export type Moneda = "COP" | "CLP"

export const MONEDAS: Record<Moneda, { locale: string; nombre: string; pais: string }> = {
  COP: { locale: "es-CO", nombre: "Peso colombiano", pais: "Colombia" },
  CLP: { locale: "es-CL", nombre: "Peso chileno",    pais: "Chile"    },
}

export const MONEDA_POR_DEFECTO: Moneda = "COP"

export interface Formato {
  moneda: Moneda
  locale: string
  /** $ 9.530 (ambas monedas se muestran sin decimales) */
  dinero(n: number): string
  /** 41 % */
  porcentaje(n: number, decimales?: number): string
  /** 05 sept */
  diaMes(f: Date | string): string
  /** 05 sept 2026 */
  fecha(f: Date | string): string
  /** 05 sept, 14:30 */
  fechaHora(f: Date | string): string
  /** 05 sept 2026, 14:30 */
  fechaHoraAnio(f: Date | string): string
  /** 14:30 */
  hora(f: Date | string): string
  /** vie 05 */
  diaSemana(f: Date | string): string
  /** septiembre de 2026 */
  mesAnio(f: Date | string): string
}

/** Una fecha "YYYY-MM-DD" se interpreta en hora local, no en UTC. */
function aFecha(f: Date | string): Date {
  if (f instanceof Date) return f
  return new Date(f.includes("T") ? f : f + "T00:00:00")
}

const cache = new Map<Moneda, Formato>()

export function formato(moneda: Moneda = MONEDA_POR_DEFECTO): Formato {
  const listo = cache.get(moneda)
  if (listo) return listo

  const { locale } = MONEDAS[moneda]
  const dinero     = new Intl.NumberFormat(locale, { style: "currency", currency: moneda, minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const diaMes     = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" })
  const fecha      = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" })
  const fechaHora  = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
  const fechaHoraA = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  const hora       = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" })
  const diaSemana  = new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit" })
  const mesAnio    = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })
  const pct        = new Map<number, Intl.NumberFormat>()

  const f: Formato = {
    moneda,
    locale,
    dinero:        n => dinero.format(n),
    porcentaje:    (n, decimales = 0) => {
      let p = pct.get(decimales)
      if (!p) { p = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: decimales, maximumFractionDigits: decimales }); pct.set(decimales, p) }
      return p.format(n)
    },
    diaMes:        x => diaMes.format(aFecha(x)),
    fecha:         x => fecha.format(aFecha(x)),
    fechaHora:     x => fechaHora.format(aFecha(x)),
    fechaHoraAnio: x => fechaHoraA.format(aFecha(x)),
    hora:          x => hora.format(aFecha(x)),
    diaSemana:     x => diaSemana.format(aFecha(x)),
    mesAnio:       x => mesAnio.format(aFecha(x)),
  }
  cache.set(moneda, f)
  return f
}

// ── Costo, IVA y margen ───────────────────────────────────────────────────────
// El costo se guarda NETO y el IVA aparte; el precio de venta ya incluye IVA.

export function costoConIva(costoNeto: number, ivaPct: number): number {
  return Math.round(costoNeto * (1 + ivaPct / 100) * 100) / 100
}

/** Utilidad por unidad: precio de venta menos costo con IVA. */
export function utilidad(precioVenta: number, costoNeto: number, ivaPct: number): number {
  return precioVenta - costoConIva(costoNeto, ivaPct)
}

/** Margen sobre el precio de venta, de 0 a 1 (null si no hay precio). */
export function margen(precioVenta: number, costoNeto: number, ivaPct: number): number | null {
  if (precioVenta <= 0) return null
  return utilidad(precioVenta, costoNeto, ivaPct) / precioVenta
}
