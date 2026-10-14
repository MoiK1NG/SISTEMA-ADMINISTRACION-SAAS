/**
 * Filtros de la tabla de inventario. Viven en un módulo plano (sin "use client")
 * para que la page de servidor valide el `?filtro=` de la URL con la misma
 * lista que usa el componente cliente.
 */
export const FILTROS_INVENTARIO = [
  "todos", "vencidos", "por_vencer", "sin_fecha", "bajo_minimo", "sin_stock", "inactivos",
] as const

export type FiltroInventario = typeof FILTROS_INVENTARIO[number]

/** Un valor cualquiera (p. ej. de la URL) → filtro válido; lo que no se reconoce cae en "todos". */
export function filtroInventarioValido(valor: unknown): FiltroInventario {
  return (FILTROS_INVENTARIO as readonly string[]).includes(valor as string)
    ? (valor as FiltroInventario)
    : "todos"
}
