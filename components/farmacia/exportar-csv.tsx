"use client"

import { Download } from "lucide-react"

interface Props {
  nombreArchivo: string
  encabezados:   string[]
  filas:         (string | number)[][]
}

/** Exporta a CSV en el navegador (separador ; para que Excel es-CO lo abra bien). */
export function ExportarCsv({ nombreArchivo, encabezados, filas }: Props) {
  function exportar() {
    const esc = (v: string | number) => {
      const s = String(v).replace(/"/g, '""')
      return /[;"\n]/.test(s) ? `"${s}"` : s
    }
    const lineas = [encabezados, ...filas].map(f => f.map(esc).join(";"))
    // BOM para que Excel detecte UTF-8 (tildes y ñ)
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = nombreArchivo
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={exportar}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" />
      Exportar CSV
    </button>
  )
}
