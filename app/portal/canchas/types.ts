// Tipos compartidos entre Server y Client components del portal de canchas

export type EstadoPago    = "pagado" | "debe_sena" | "pendiente"
export type EstadoReserva = "confirmada" | "cancelada" | "no_show"

export interface Cancha {
  id:          string
  nombre:      string
  tipo:        string
  precio_hora?: number
  color?:      string
}

export interface Reserva {
  id:               string
  canchaId:         string
  clienteNombre:    string
  clienteTelefono?: string
  horaInicio:       number
  horaFin:          number
  estadoPago:       EstadoPago
  estado:           EstadoReserva
  monto:            number
  montoPagado:      number
  nota?:            string
}
