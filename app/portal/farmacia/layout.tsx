import { NegocioProvider } from "@/components/farmacia/negocio-provider"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { MONEDA_POR_DEFECTO } from "@/lib/farmacia/formato"

/**
 * Resuelve el negocio una vez (contextoFarmacia está memoizada por request,
 * así que las páginas no pagan una consulta extra) y expone su moneda e IVA a
 * todo el árbol cliente del portal.
 */
export default async function FarmaciaLayout({ children }: { children: React.ReactNode }) {
  const { negocio } = await contextoFarmacia()
  return (
    <NegocioProvider
      moneda={negocio?.moneda ?? MONEDA_POR_DEFECTO}
      ivaDefault={negocio?.iva_pct_default ?? 0}
    >
      {children}
    </NegocioProvider>
  )
}
