"use client"

import { useState } from "react"
import { Check, Copy, KeyRound, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Sin caracteres que se confunden al dictarlos o copiarlos a mano (0/O, 1/l/I)
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Contraseña inicial legible de 10 caracteres, con aleatoriedad criptográfica. */
export function generarClave(largo = 10): string {
  const bytes = new Uint32Array(largo)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => ALFABETO[b % ALFABETO.length]).join("")
}

/** Campo de contraseña inicial con botón para generar una. */
export function CampoClaveInicial({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Contraseña inicial</Label>
      <div className="flex gap-1.5">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          className="font-mono"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => onChange(generarClave())}
          title="Generar una contraseña"
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />Generar
        </button>
      </div>
      <p className="text-xs text-slate-400">Al entrar por primera vez, la persona tendrá que cambiarla por una propia.</p>
    </div>
  )
}

/** Credenciales recién creadas: se muestran una sola vez para pasarlas en persona. */
export function CredencialesCreadas({ nombre, email, clave, onListo }: {
  nombre: string; email: string; clave: string; onListo: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const texto = `Usuario: ${email}\nContraseña inicial: ${clave}`

  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
    catch { /* sin permiso de portapapeles: queda visible para copiar a mano */ }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-800">Cuenta de {nombre} creada</p>
        <p className="mt-0.5 text-xs text-emerald-700">
          Pásale estos datos en persona. Al entrar, el sistema le va a pedir que elija su propia contraseña.
        </p>
      </div>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm">
        <p><span className="text-slate-400">Usuario:</span> <span className="text-slate-900">{email}</span></p>
        <p className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-bold tracking-wide text-slate-900">{clave}</span>
        </p>
      </div>
      <p className="text-xs text-amber-700">Esta contraseña no se vuelve a mostrar. Si se pierde, la persona puede usar "¿Olvidaste tu contraseña?".</p>
      <div className="flex gap-3">
        <button type="button" onClick={copiar}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {copiado ? <><Check className="h-4 w-4 text-emerald-600" />Copiado</> : <><Copy className="h-4 w-4" />Copiar datos</>}
        </button>
        <button type="button" onClick={onListo}
                className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Listo
        </button>
      </div>
    </div>
  )
}
