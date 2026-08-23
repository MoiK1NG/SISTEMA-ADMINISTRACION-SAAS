"use client"

// ─── Client Component raíz del POS ───────────────────────────────────────────
// Contiene TODO el estado: carrito, modal, búsqueda.
// Recibe los productos desde el Server Component (page.tsx) como props.

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Catalogo }    from "./catalogo"
import { Carrito }     from "./carrito"
import { ModalCobro }  from "./modal-cobro"
import { registrarVentaPos } from "../actions"
import type { Producto, ItemCarrito } from "../types"

interface Props {
  productos: Producto[]
}

export function PosShell({ productos }: Props) {
  const router = useRouter()
  const [carrito,      setCarrito]      = useState<ItemCarrito[]>([])
  const [modalAbierto, setModalAbierto] = useState(false)

  // ── Mutaciones del carrito ────────────────────────────────────────────────
  const agregar = useCallback((producto: Producto) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto.id === producto.id)
      if (existe) {
        return prev.map(i =>
          i.producto.id === producto.id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i
        )
      }
      return [...prev, { producto, cantidad: 1 }]
    })
  }, [])

  const sumar = useCallback((id: string) => {
    setCarrito(prev =>
      prev.map(i => i.producto.id === id ? { ...i, cantidad: i.cantidad + 1 } : i)
    )
  }, [])

  const restar = useCallback((id: string) => {
    setCarrito(prev =>
      prev
        .map(i => i.producto.id === id ? { ...i, cantidad: i.cantidad - 1 } : i)
        .filter(i => i.cantidad > 0)
    )
  }, [])

  const eliminar = useCallback((id: string) => {
    setCarrito(prev => prev.filter(i => i.producto.id !== id))
  }, [])

  const limpiar = useCallback(() => setCarrito([]), [])

  // ── Cobro real ────────────────────────────────────────────────────────────
  // El servidor recalcula precios desde el catálogo; acá solo van ids y cantidades.
  const confirmarCobro = useCallback(async (metodo: string, montoRecibido?: number) => {
    await registrarVentaPos(
      carrito.map(i => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
      metodo,
      montoRecibido,
    )
  }, [carrito])

  const ventaCompletada = useCallback(() => {
    setCarrito([])
    setModalAbierto(false)
    router.refresh()
  }, [router])

  return (
    <>
      {/* Layout 2 columnas — 70/30 */}
      <div className="flex gap-4 h-full">

        {/* ── Columna izquierda: Catálogo (70%) ─────────────────────────── */}
        <div className="flex-[7] min-w-0 overflow-hidden">
          <Catalogo
            productos={productos}
            carrito={carrito}
            onAgregar={agregar}
          />
        </div>

        {/* ── Columna derecha: Carrito (30%) ────────────────────────────── */}
        <div className="flex-[3] min-w-[280px] max-w-[360px] shrink-0">
          <Carrito
            items={carrito}
            onSumar={sumar}
            onRestar={restar}
            onEliminar={eliminar}
            onLimpiar={limpiar}
            onCobrar={() => setModalAbierto(true)}
          />
        </div>
      </div>

      {/* Modal de cobro */}
      <ModalCobro
        open={modalAbierto}
        items={carrito}
        onClose={() => setModalAbierto(false)}
        onConfirmar={confirmarCobro}
        onVentaCompletada={ventaCompletada}
      />
    </>
  )
}
