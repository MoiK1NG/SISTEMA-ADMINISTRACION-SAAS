"use client"

import { createContext, useContext } from "react"
import { formato, type Formato, type Moneda, MONEDA_POR_DEFECTO } from "@/lib/farmacia/formato"

export interface NegocioResumen {
  nombre:    string
  nit:       string | null
  direccion: string | null
  telefono:  string | null
  logo_url:  string | null
  color:     string | null
}

interface NegocioUI {
  moneda:     Moneda
  /** IVA que se propone al crear un producto (19 en Chile, 0 en Colombia). */
  ivaDefault: number
  /** Datos del negocio para comprobantes y cabeceras. */
  negocio:    NegocioResumen
}

const SIN_NEGOCIO: NegocioResumen = { nombre: "", nit: null, direccion: null, telefono: null, logo_url: null, color: null }

const Ctx = createContext<NegocioUI>({ moneda: MONEDA_POR_DEFECTO, ivaDefault: 0, negocio: SIN_NEGOCIO })

/**
 * Pone la moneda, el IVA y los datos del negocio al alcance de los componentes
 * cliente del portal. Lo monta el layout de /portal/farmacia con el negocio ya
 * resuelto, así ninguna página tiene que pasarlos prop por prop.
 */
export function NegocioProvider({ moneda, ivaDefault, negocio, children }: NegocioUI & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ moneda, ivaDefault, negocio }}>{children}</Ctx.Provider>
}

export function useNegocioUI(): NegocioUI {
  return useContext(Ctx)
}

/** Formateadores (dinero, fechas, porcentajes) en la moneda del negocio. */
export function useFormato(): Formato {
  return formato(useContext(Ctx).moneda)
}
