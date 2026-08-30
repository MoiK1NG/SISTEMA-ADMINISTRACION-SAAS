"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { UserPlus, MoreHorizontal, Trash2, ShieldCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { agregarMiembro, cambiarRolMiembro, quitarMiembro } from "../../actions"

export interface FilaMiembro {
  id:       string
  user_id:  string
  rol:      "dueno" | "regente" | "cajero"
  nombre:   string
  email:    string
  aprobado: boolean
  desde:    string
}

const ROL_META: Record<FilaMiembro["rol"], { label: string; desc: string; clases: string }> = {
  dueno:   { label: "Dueño",   desc: "Acceso total, finanzas y equipo",              clases: "bg-teal-50 text-teal-700 border-teal-200"     },
  regente: { label: "Regente", desc: "Compras, inventario y pedidos — sin finanzas", clases: "bg-blue-50 text-blue-700 border-blue-200"     },
  cajero:  { label: "Cajero",  desc: "Solo POS: facturar, cobrar y clientes",        clases: "bg-slate-100 text-slate-600 border-slate-200" },
}

const fmtFecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso))

interface Props {
  miembros:  FilaMiembro[]
  puedeGestionar: boolean
  miUserId:  string
}

export function EquipoManager({ miembros, puedeGestionar, miUserId }: Props) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [email, setEmail]     = useState("")
  const [rol, setRol]         = useState<FilaMiembro["rol"]>("cajero")
  const [error, setError]     = useState<string | null>(null)
  const [aviso, setAviso]     = useState<string | null>(null)
  const [isPending, start]    = useTransition()

  function correr(fn: () => Promise<unknown>) {
    setError(null)
    start(async () => {
      try { await fn(); router.refresh() }
      catch (e: any) { setError(e?.message ?? "No se pudo completar la acción") }
    })
  }

  function handleAgregar() {
    setError(null); setAviso(null)
    start(async () => {
      try {
        const r = await agregarMiembro(email, rol)
        setOpen(false); setEmail(""); setRol("cajero")
        if (!r.aprobado) {
          setAviso(`${r.nombre} quedó en el equipo, pero su cuenta todavía no fue aprobada por la plataforma — no va a poder entrar hasta que se apruebe.`)
        }
        router.refresh()
      } catch (e: any) {
        setError(e?.message ?? "No se pudo agregar")
      }
    })
  }

  return (
    <div className="space-y-4">
      {aviso && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{aviso}</p>
      )}
      {error && !open && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {miembros.length} {miembros.length === 1 ? "persona" : "personas"} en el equipo
        </p>
        {puedeGestionar && (
          <Button size="sm" onClick={() => { setError(null); setOpen(true) }} className="gap-1.5 bg-teal-600 hover:bg-teal-700">
            <UserPlus className="h-3.5 w-3.5" />Agregar persona
          </Button>
        )}
      </div>

      <div className={`grid gap-3 sm:grid-cols-2 ${isPending ? "opacity-60" : ""}`}>
        {miembros.map(m => {
          const meta = ROL_META[m.rol]
          return (
            <div key={m.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600/10 text-sm font-bold text-teal-700">
                {(m.nombre || m.email)[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {m.nombre}
                  {m.user_id === miUserId && <span className="ml-1.5 text-xs font-normal text-slate-400">(vos)</span>}
                </p>
                <p className="truncate text-xs text-slate-400">{m.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.clases}`}>
                    <ShieldCheck className="h-2.5 w-2.5" />{meta.label}
                  </span>
                  {!m.aprobado && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Cuenta sin aprobar
                    </span>
                  )}
                  <span className="text-[10px] text-slate-300">desde {fmtFecha(m.desde)}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">{meta.desc}</p>
              </div>

              {puedeGestionar && m.user_id !== miUserId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" disabled={isPending}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-xs font-normal text-slate-400">Cambiar rol</DropdownMenuLabel>
                    {(Object.keys(ROL_META) as FilaMiembro["rol"][])
                      .filter(r => r !== m.rol)
                      .map(r => (
                        <DropdownMenuItem key={r} className="cursor-pointer text-sm"
                          onClick={() => correr(() => cambiarRolMiembro(m.id, r))}>
                          Hacer {ROL_META[r].label.toLowerCase()}
                        </DropdownMenuItem>
                      ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer gap-2 text-sm text-rose-600 focus:text-rose-700"
                      onClick={() => {
                        if (confirm(`¿Quitar a ${m.nombre} del equipo? Pierde el acceso al portal.`)) {
                          correr(() => quitarMiembro(m.id))
                        }
                      }}>
                      <Trash2 className="h-4 w-4" />Quitar del equipo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Dialog agregar ──────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Agregar al equipo</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

            <p className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
              La persona primero debe <strong>crear su cuenta</strong> en la página de registro
              con el correo que ingreses acá. No paga membresía: hereda la del negocio.
            </p>

            <div className="space-y-1.5">
              <Label>Correo de la persona</Label>
              <Input
                type="email" placeholder="cajero@correo.com" autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Rol</Label>
              <div className="grid gap-2">
                {(Object.keys(ROL_META) as FilaMiembro["rol"][]).map(r => (
                  <button
                    key={r} type="button" onClick={() => setRol(r)}
                    className={`rounded-xl border-2 px-3.5 py-2.5 text-left transition-colors ${
                      rol === r ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900">{ROL_META[r].label}</p>
                    <p className="text-xs text-slate-500">{ROL_META[r].desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-700"
                onClick={handleAgregar}
                disabled={isPending || !email.trim()}
              >
                {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Agregando…</> : "Agregar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
