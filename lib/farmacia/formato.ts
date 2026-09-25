/**
 * Formateadores es-CO del portal de farmacia.
 *
 * Crear un Intl.NumberFormat / DateTimeFormat es caro y las tablas lo hacían
 * una vez por celda; acá se crean una sola vez al cargar el módulo.
 */

export const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 })

/** 05 sept */
export const DIA_MES = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" })

/** 05 sept 2026 */
export const FECHA = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" })

/** 05 sept, 14:30 */
export const FECHA_HORA = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

/** 05 sept 2026, 14:30 */
export const FECHA_HORA_ANIO = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

/** 14:30 */
export const HORA = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" })

/** vie 05 */
export const DIA_SEMANA = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "2-digit" })

/** septiembre de 2026 */
export const MES_ANIO = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" })
