"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProductoFormDialog } from "../../_components/producto-form"
import type { FilaProducto, CatalogoItem } from "../../_components/inventario-farmacia"

/** Botón "Editar producto" del detalle: abre el mismo formulario del inventario. */
export function EditarProducto({ producto, proveedores, laboratorios }: {
  producto:     FilaProducto
  proveedores:  CatalogoItem[]
  laboratorios: CatalogoItem[]
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAbierto(true)} className="gap-1.5">
        <Pencil className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Editar producto</span>
      </Button>
      <ProductoFormDialog
        open={abierto}
        onOpenChange={setAbierto}
        producto={producto}
        proveedores={proveedores}
        laboratorios={laboratorios}
      />
    </>
  )
}
