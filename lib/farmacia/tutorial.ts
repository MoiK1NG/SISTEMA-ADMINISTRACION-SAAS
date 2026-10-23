import {
  Grid2x2, ScanBarcode, UserRound, CreditCard, FileText, Printer, ClipboardList,
  ArrowUpFromLine, Lock, Boxes, CalendarClock, Truck, Receipt, LayoutDashboard,
  Building2, Users, Wallet, PartyPopper, HeartPulse,
} from "lucide-react"
import type { RolFarmacia } from "./contexto"

/**
 * Tutorial de primer ingreso del portal de farmacia (reunión del 21 oct).
 *
 * Cada rol ve solo lo que puede hacer: el cajero no ve finanzas ni equipo.
 * Se marca como visto en user_metadata.tutorial_farmacia con esta versión;
 * subirla vuelve a mostrarlo a todos después de un cambio grande.
 */
export const TUTORIAL_VERSION = 1

export interface PasoTutorial {
  icono:  React.ComponentType<{ className?: string }>
  titulo: string
  texto:  string
  /** Pantalla a la que lleva "Ir ahora". */
  href?:  string
}

const BIENVENIDA = (rol: string): PasoTutorial => ({
  icono:  PartyPopper,
  titulo: "Bienvenido a LOMS 360",
  texto:  `Este recorrido muestra lo que puedes hacer como ${rol}. Son pocos pasos; puedes saltarlo y repetirlo cuando quieras desde "Ver tutorial" en la barra.`,
})

const CAJA: PasoTutorial[] = [
  {
    icono: Grid2x2, titulo: "Vender", href: "/portal/farmacia/pos",
    texto: "En Vender armas la venta. Los productos sin stock o vencidos no se pueden agregar, y si uno no tiene stock te sugiere equivalentes con el mismo principio activo.",
  },
  {
    icono: ScanBarcode, titulo: "Lector o búsqueda",
    texto: "El lector de código de barras funciona directo sobre el buscador. También puedes escribir el nombre o el principio activo.",
  },
  {
    icono: UserRound, titulo: "Cliente (opcional)",
    texto: "Asocia la venta a un cliente para tener su historial. Si no existe, lo creas ahí mismo con nombre y documento.",
  },
  {
    icono: CreditCard, titulo: "Cobrar",
    texto: "Puedes cobrar con varios métodos a la vez: efectivo, débito, crédito y transferencia. En efectivo, el sistema calcula el vuelto.",
  },
  {
    icono: FileText, titulo: "Productos con receta",
    texto: "Si un producto requiere receta, antes de cobrar te pide paciente, médico y número de receta. Queda registrado en Recetas.",
  },
  {
    icono: Printer, titulo: "Comprobante",
    texto: "Después de cada venta puedes imprimir el comprobante desde el botón de la última venta.",
  },
  {
    icono: ClipboardList, titulo: "Encargos", href: "/portal/farmacia/pedidos",
    texto: "En Pedidos anotas lo que un cliente encarga, con anticipo si deja plata. Al entregarlo cobras el saldo.",
  },
  {
    icono: ArrowUpFromLine, titulo: "Retiros y gastos", href: "/portal/farmacia/caja",
    texto: "Si sacas efectivo de la caja (un retiro para el dueño o un gasto como el agua), regístralo en Cierre con los botones \"Retiro de caja\" o \"Gasto\". El cierre lo descuenta.",
  },
  {
    icono: Lock, titulo: "Cierre de caja", href: "/portal/farmacia/caja",
    texto: "Al terminar el turno cuentas la plata y declaras los totales sin ver lo esperado. El sistema compara después y guarda la diferencia.",
  },
]

const SALIDA_CAJERO: PasoTutorial = {
  icono: Lock, titulo: "Al cerrar, se cierra tu sesión",
  texto: "Cuando cierras la caja ves el resultado y, a los 30 segundos, tu sesión se cierra sola. Así nadie vende con tu usuario.",
}

const GESTION: PasoTutorial[] = [
  {
    icono: Boxes, titulo: "Inventario", href: "/portal/farmacia/inventario",
    texto: "Cada producto tiene sus lotes con fecha de vencimiento. El semáforo te avisa qué vence pronto y el POS vende primero lo que vence antes.",
  },
  {
    icono: CalendarClock, titulo: "Lotes sin fecha y stock mínimo",
    texto: "Los lotes de la carga inicial quedaron \"Sin fecha\": complétala desde el detalle del producto. Define un stock mínimo para que el panel te avise cuando falte.",
  },
  {
    icono: Truck, titulo: "Compras", href: "/portal/farmacia/compras",
    texto: "Registra lo que debes a cada proveedor y ve abonando. Así sabes cuánto debes y a quién.",
  },
  {
    icono: Receipt, titulo: "Ventas y anulaciones", href: "/portal/farmacia/ventas",
    texto: "En Ventas ves todo lo vendido por fecha y puedes exportarlo. Si una venta se hizo mal, la anulas con motivo y el stock vuelve.",
  },
  {
    icono: HeartPulse, titulo: "Pacientes crónicos", href: "/portal/farmacia/pacientes",
    texto: "Lleva el tratamiento de los pacientes que compran todos los meses; el panel avisa cuándo les toca reponer.",
  },
]

const DUENO: PasoTutorial[] = [
  {
    icono: LayoutDashboard, titulo: "El panel", href: "/portal/farmacia",
    texto: "Al entrar ves lo que pide atención hoy: productos vencidos o por vencer, stock bajo el mínimo, pacientes por reponer y cuentas vencidas. También verás \"Primeros pasos\" hasta que dejes todo listo.",
  },
  {
    icono: Building2, titulo: "Datos del negocio",
    texto: "Desde el panel completas el nombre, el RUT o NIT, la dirección y el teléfono, y eliges el logo y el color de tu farmacia. Salen en la barra y en el comprobante de venta.",
  },
  {
    icono: Users, titulo: "Tu equipo", href: "/portal/farmacia/equipo",
    texto: "En Equipo creas las cuentas de tus cajeros y regentes con una contraseña inicial que les entregas en persona; al primer ingreso, cada uno elige la suya. Ves cuándo entró cada uno y puedes suspender a alguien sin quitarlo.",
  },
  {
    icono: Wallet, titulo: "Finanzas (solo tú)", href: "/portal/farmacia/finanzas",
    texto: "Lo vendido, el margen, lo que debes y te deben, los gastos de caja y el valor de tu inventario. Nadie más del equipo ve esta sección.",
  },
]

export function pasosTutorial(rol: RolFarmacia): PasoTutorial[] {
  if (rol === "cajero")  return [BIENVENIDA("cajero"), ...CAJA, SALIDA_CAJERO]
  if (rol === "regente") return [BIENVENIDA("regente"), ...CAJA, ...GESTION]
  return [BIENVENIDA("dueño"), ...DUENO, ...CAJA, ...GESTION]
}
