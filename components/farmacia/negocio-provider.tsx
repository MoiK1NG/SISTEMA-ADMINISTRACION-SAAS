"use client"

import { createContext, useContext } from "react"
import { formato, type Formato, type Moneda, MONEDA_POR_DEFECTO } from "@/lib/farmacia/formato"

interface NegocioUI {
  moneda:     Moneda
  /** IVA que se propone al crear un producto (19 en Chile, 0 en Colombia). */
  ivaDefault: number
}

const Ctx = createContext<NegocioUI>({ moneda: MONEDA_POR_DEFECTO, ivaDefault: 0 })

/**
 * Pone la moneda y el IVA del negocio al alcance de los componentes cliente
 * del portal. Lo monta el layout de /portal/farmacia con el negocio ya
 * resuelto, así ninguna página tiene que pasar la moneda prop por prop.
 */
export function NegocioProvider({ moneda, ivaDefault, children }: NegocioUI & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ moneda, ivaDefault }}>{children}</Ctx.Provider>
}

export function useNegocioUI(): NegocioUI {
  return useContext(Ctx)
}

/** Formateadores (dinero, fechas, porcentajes) en la moneda del negocio. */
export function useFormato(): Formato {
  return formato(useContext(Ctx).moneda)
}
