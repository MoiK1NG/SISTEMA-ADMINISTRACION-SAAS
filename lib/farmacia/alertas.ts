import type { ContextoFarmacia } from "@/lib/farmacia/contexto"
import { DIAS_ROJO, DIAS_AVISO_CRONICO } from "@/lib/farmacia/caducidad"
import { fechaHoy, sumarDias, diferenciaDias, type Moneda } from "@/lib/farmacia/formato"

export interface AlertasHoy {
  /** Productos cuyo lote más próximo ya venció y todavía tiene unidades */
  vencidos:     number
  /** Productos que vencen en DIAS_ROJO días o menos */
  por_vencer:   number
  /** Productos con lotes cargados sin fecha de vencimiento */
  sin_fecha:    number
  /** Productos por debajo de su stock mínimo */
  bajo_minimo:  number
  /** Pacientes crónicos a DIAS_AVISO_CRONICO días o menos de quedarse sin medicamento */
  cronicos:     number
  /** Cuentas por pagar vencidas; null = el rol no las ve (cajero) */
  cxp_vencidas: number | null
}

/**
 * Alertas del inicio del portal, calculadas en vivo (no desde el resumen
 * nocturno del cron: ese lo leen solo los admins, y si el regente corrige un
 * lote a las 10:00 la alerta tiene que desaparecer a las 10:01).
 *
 * Se cuentan PRODUCTOS desde la vista stock_farmacia, así cada número
 * coincide con las filas del filtro de inventario al que enlaza. Son 5
 * consultas `count` indexadas por negocio más los tratamientos activos.
 */
export async function alertasDeHoy(
  supabase:  ContextoFarmacia["supabase"],
  negocioId: string,
  moneda:    Moneda,
  esGestor:  boolean,
): Promise<AlertasHoy> {
  const hoy    = fechaHoy(moneda)
  const limite = sumarDias(hoy, DIAS_ROJO)

  const stock = () => supabase
    .from("stock_farmacia")
    .select("producto_id", { count: "exact", head: true })
    .eq("negocio_id", negocioId)
    .eq("activo", true)

  const [vencidos, porVencer, sinFecha, bajoMinimo, tratamientos, cxp] = await Promise.all([
    stock().lt("proximo_vencimiento", hoy),
    stock().gte("proximo_vencimiento", hoy).lte("proximo_vencimiento", limite),
    stock().gt("lotes_sin_fecha", 0),
    stock().eq("bajo_minimo", true),
    supabase.from("tratamientos_farmacia")
      .select("ultima_compra, dias_duracion")
      .eq("negocio_id", negocioId).eq("activo", true),
    esGestor
      ? supabase.from("cuentas_pagar_farmacia")
          .select("id", { count: "exact", head: true })
          .eq("negocio_id", negocioId)
          .in("estado", ["pendiente", "parcial"])
          .lt("fecha_vencimiento", hoy)
      : Promise.resolve({ count: null as number | null }),
  ])

  // "Se acaba" = última compra + días de duración (misma cuenta que la pantalla de pacientes)
  const cronicos = (tratamientos.data ?? []).filter((t: any) =>
    diferenciaDias(sumarDias(t.ultima_compra, Number(t.dias_duracion)), hoy) <= DIAS_AVISO_CRONICO
  ).length

  return {
    vencidos:     vencidos.count ?? 0,
    por_vencer:   porVencer.count ?? 0,
    sin_fecha:    sinFecha.count ?? 0,
    bajo_minimo:  bajoMinimo.count ?? 0,
    cronicos,
    cxp_vencidas: esGestor ? (cxp.count ?? 0) : null,
  }
}
