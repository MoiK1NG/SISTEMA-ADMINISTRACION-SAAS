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
