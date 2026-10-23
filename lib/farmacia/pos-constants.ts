export const METODOS_PAGO_FARMACIA = [
  "efectivo", "tarjeta_debito", "tarjeta_credito", "transferencia",
] as const

export type MetodoPagoFarmacia = (typeof METODOS_PAGO_FARMACIA)[number]

export const METODO_PAGO_LABEL: Record<MetodoPagoFarmacia, string> = {
  efectivo:        "Efectivo",
  tarjeta_debito:  "T. Débito",
  tarjeta_credito: "T. Crédito",
  transferencia:   "Transferencia",
}

// ── Retiros y gastos de caja (efectivo que sale del cajón sin ser venta) ─────
export const TIPOS_MOVIMIENTO_CAJA = ["retiro", "gasto"] as const
export type TipoMovimientoCaja = (typeof TIPOS_MOVIMIENTO_CAJA)[number]

export const CATEGORIAS_GASTO = ["insumos", "aseo", "transporte", "propinas", "otros"] as const
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number]

export const CATEGORIA_GASTO_LABEL: Record<CategoriaGasto, string> = {
  insumos:    "Insumos del local",
  aseo:       "Aseo y mantención",
  transporte: "Transporte y envíos",
  propinas:   "Propinas y aguinaldos",
  otros:      "Otros",
}
