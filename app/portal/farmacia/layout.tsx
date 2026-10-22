import { NegocioProvider } from "@/components/farmacia/negocio-provider"
import { TutorialFarmacia } from "@/components/farmacia/tutorial"
import { sesionActual } from "@/lib/admin-context"
import { contextoFarmacia } from "@/lib/farmacia/contexto"
import { MONEDA_POR_DEFECTO } from "@/lib/farmacia/formato"
import { TUTORIAL_VERSION } from "@/lib/farmacia/tutorial"

/**
 * Resuelve el negocio una vez (contextoFarmacia está memoizada por request,
 * así que las páginas no pagan una consulta extra) y expone su moneda, IVA y
 * datos a todo el árbol cliente del portal.
 */
export default async function FarmaciaLayout({ children }: { children: React.ReactNode }) {
  const [{ negocio, rol, viendoA }, { user }] = await Promise.all([contextoFarmacia(), sesionActual()])

  // Tutorial de primer ingreso: se abre solo hasta que la persona lo cierra
  // (queda en su user_metadata). En "ver como" no se abre solo ni se marca.
  const tutorialVisto = Number(user?.user_metadata?.tutorial_farmacia ?? 0) >= TUTORIAL_VERSION
  return (
    <NegocioProvider
      moneda={negocio?.moneda ?? MONEDA_POR_DEFECTO}
      ivaDefault={negocio?.iva_pct_default ?? 0}
      negocio={{
        nombre:    negocio?.nombre ?? "",
        nit:       negocio?.nit ?? null,
        direccion: negocio?.direccion ?? null,
        telefono:  negocio?.telefono ?? null,
        logo_url:  negocio?.logo_url ?? null,
        color:     negocio?.color ?? null,
      }}
    >
      {children}
      {rol && <TutorialFarmacia rol={rol} autoAbrir={!viendoA && !tutorialVisto} marcarVisto={!viendoA} />}
    </NegocioProvider>
  )
}
