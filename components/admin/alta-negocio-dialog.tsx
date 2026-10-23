"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Check, Copy, Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CampoClaveInicial, generarClave } from "@/components/credenciales-iniciales"
import { altaNegocioFarmacia } from "@/app/admin/actions"

export interface PlanAlta {
  id:          string
  nombre:      string
  dias:        number
  maxRegentes: number | null
  maxCajeros:  number | null
}

type Rol = "regente" | "cajero"
interface Persona { nombre: string; email: string; clave: string; rol: Rol }

// País → moneda e IVA propuesto (el IVA se puede corregir en el paso 1)
const PAISES = {
  CL: { nombre: "Chile",    moneda: "CLP" as const, iva: 19 },
  CO: { nombre: "Colombia", moneda: "COP" as const, iva: 0  },
}
type Pais = keyof typeof PAISES

const PASOS = ["Negocio", "Dueño", "Plan y equipo"]
const hoy = () => new Date().toISOString().split("T")[0]

/**
 * Alta de un negocio en tres pasos. Nada se crea hasta "Dar de alta": ahí el
 * servidor crea todo o, si algo falla, deshace lo que alcanzó a crear. Las
 * contraseñas iniciales se muestran una sola vez al final.
 */
export function AltaNegocioDialog({ planes }: { planes: PlanAlta[] }) {
  const router = useRouter()
  const [open, setOpen]   = useState(false)
  const [paso, setPaso]   = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  // Paso 1
  const [nombre, setNombre] = useState("")
  const [pais, setPais]     = useState<Pais>("CL")
  const [iva, setIva]       = useState("19")
  // Paso 2
  const [modoDueno, setModoDueno] = useState<"nueva" | "existente">("nueva")
  const [dueno, setDueno] = useState({ nombre: "", email: "", clave: "" })
  // Paso 3
  const [planId, setPlanId] = useState("")
  const [inicio, setInicio] = useState(hoy())
  const [equipo, setEquipo] = useState<Persona[]>([])
  // Resultado
  const [creado, setCreado] = useState<{ negocio: string; vence: string; cuentas: { nombre: string; rol: string; email: string; clave: string }[] } | null>(null)
  const [copiado, setCopiado] = useState(false)

  function abrir() {
    setPaso(0); setError(null); setCreado(null)
    setNombre(""); setPais("CL"); setIva("19")
    setModoDueno("nueva"); setDueno({ nombre: "", email: "", clave: generarClave() })
    setPlanId(planes[0]?.id ?? ""); setInicio(hoy()); setEquipo([])
    setOpen(true)
  }

  const plan = planes.find(p => p.id === planId)
  const cuenta = (rol: Rol) => equipo.filter(p => p.rol === rol).length
  const tope = (rol: Rol) => (rol === "regente" ? plan?.maxRegentes : plan?.maxCajeros) ?? null
  const excede = (["regente", "cajero"] as Rol[]).find(r => tope(r) !== null && cuenta(r) > tope(r)!)

  const pasoValido = [
    nombre.trim().length >= 2 && Number(iva) >= 0 && Number(iva) <= 100 && iva.trim() !== "",
    dueno.email.includes("@") && (modoDueno === "existente" || (dueno.nombre.trim() !== "" && dueno.clave.length >= 8)),
    Boolean(plan) && Boolean(inicio) && !excede &&
      equipo.every(p => p.nombre.trim() && p.email.includes("@") && p.clave.length >= 8),
  ]

  function sumarPersona(rol: Rol) {
    setEquipo(e => [...e, { nombre: "", email: "", clave: generarClave(), rol }])
  }
  function cambiarPersona(i: number, cambio: Partial<Persona>) {
    setEquipo(e => e.map((p, n) => (n === i ? { ...p, ...cambio } : p)))
  }

  function darDeAlta() {
    setError(null)
    start(async () => {
      try {
        const r = await altaNegocioFarmacia({
          nombre,
          moneda: PAISES[pais].moneda,
          iva:    Number(iva),
          dueno:  modoDueno === "nueva"
            ? { modo: "nueva", nombre: dueno.nombre, email: dueno.email, clave: dueno.clave }
            : { modo: "existente", email: dueno.email },
          planId, inicio,
          equipo: equipo.map(p => ({ nombre: p.nombre, email: p.email, clave: p.clave, rol: p.rol })),
        })
        setCreado({
          negocio: r.nombre, vence: r.vence,
          cuentas: [
            ...(modoDueno === "nueva" ? [{ nombre: dueno.nombre.trim(), rol: "Dueño", email: dueno.email.trim().toLowerCase(), clave: dueno.clave }] : []),
            ...equipo.map(p => ({ nombre: p.nombre.trim(), rol: p.rol === "regente" ? "Regente" : "Cajero", email: p.email.trim().toLowerCase(), clave: p.clave })),
          ],
        })
        router.refresh()
      } catch (e: any) { setError(e?.message ?? "No se pudo dar de alta el negocio") }
    })
  }

  async function copiarTodo() {
    if (!creado) return
    const texto = creado.cuentas.map(c => `${c.nombre} (${c.rol})\nUsuario: ${c.email}\nContraseña inicial: ${c.clave}`).join("\n\n")
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
    catch { /* sin permiso de portapapeles: queda visible para copiar a mano */ }
  }

  return (
    <>
      <Button onClick={abrir} className="gap-1.5" disabled={planes.length === 0}
              title={planes.length === 0 ? "Primero crea un plan activo" : undefined}>
        <Building2 className="h-4 w-4" />Nuevo negocio
      </Button>

      <Dialog open={open} onOpenChange={v => { if (!isPending) setOpen(v) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{creado ? "Negocio creado" : "Nuevo negocio"}</DialogTitle></DialogHeader>

          {creado ? (
            /* ── Resultado: credenciales una sola vez ─────────────────────── */
            <div className="mt-2 space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-800">{creado.negocio} quedó listo</p>
                <p className="mt-0.5 text-xs text-emerald-700">Membresía vigente hasta el {creado.vence}.</p>
              </div>
              {creado.cuentas.length > 0 ? (
                <>
                  <p className="text-xs text-slate-500">
                    Estas contraseñas iniciales <strong>no se vuelven a mostrar</strong>. Entrégalas en persona:
                    al primer ingreso cada uno elige la suya.
                  </p>
                  <div className="divide-y rounded-xl border">
                    {creado.cuentas.map(c => (
                      <div key={c.email} className="px-4 py-2.5 text-sm">
                        <p className="font-medium">{c.nombre} <span className="text-xs font-normal text-slate-400">· {c.rol}</span></p>
                        <p className="font-mono text-xs text-slate-600">{c.email} · {c.clave}</p>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full gap-1.5" onClick={copiarTodo}>
                    {copiado ? <><Check className="h-3.5 w-3.5" />Copiado</> : <><Copy className="h-3.5 w-3.5" />Copiar todo</>}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-slate-500">El dueño entra con la cuenta que ya tenía.</p>
              )}
              <Button className="w-full" onClick={() => setOpen(false)}>Listo</Button>
            </div>
          ) : (
            <div className="mt-1 space-y-4">
              {/* Pasos */}
              <div className="flex gap-2">
                {PASOS.map((p, n) => (
                  <div key={p} className={`flex-1 rounded-full py-1 text-center text-[11px] font-semibold ${
                    n === paso ? "bg-brand-600 text-white" : n < paso ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"
                  }`}>{n + 1}. {p}</div>
                ))}
              </div>

              {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

              {paso === 0 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Nombre del negocio</Label>
                    <Input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej.: Farmacia San Rafael" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>País</Label>
                      <select value={pais} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              onChange={e => { const p = e.target.value as Pais; setPais(p); setIva(String(PAISES[p].iva)) }}>
                        {(Object.keys(PAISES) as Pais[]).map(p => (
                          <option key={p} value={p}>{PAISES[p].nombre} ({PAISES[p].moneda})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>IVA por defecto (%)</Label>
                      <Input type="number" min="0" max="100" value={iva} onChange={e => setIva(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    La moneda define cómo se ven los precios. El IVA es el que se propone al crear cada producto.
                  </p>
                </div>
              )}

              {paso === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {(["nueva", "existente"] as const).map(m => (
                      <button key={m} type="button" onClick={() => setModoDueno(m)}
                              className={`rounded-xl border px-3 py-2 text-left text-xs ${modoDueno === m ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                        <p className="font-semibold text-slate-800">{m === "nueva" ? "Crear su cuenta" : "Ya tiene cuenta"}</p>
                        <p className="text-slate-500">{m === "nueva" ? "Con contraseña inicial" : "Se busca por correo"}</p>
                      </button>
                    ))}
                  </div>
                  {modoDueno === "nueva" && (
                    <div className="space-y-1.5">
                      <Label>Nombre del dueño</Label>
                      <Input value={dueno.nombre} onChange={e => setDueno(d => ({ ...d, nombre: e.target.value }))} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Correo del dueño</Label>
                    <Input type="email" value={dueno.email} onChange={e => setDueno(d => ({ ...d, email: e.target.value }))} />
                  </div>
                  {modoDueno === "nueva"
                    ? <CampoClaveInicial value={dueno.clave} onChange={v => setDueno(d => ({ ...d, clave: v }))} />
                    : <p className="text-xs text-slate-400">La cuenta no puede pertenecer a otro negocio. Si ya tiene una membresía activa, la nueva la reemplaza.</p>}
                </div>
              )}

              {paso === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Plan</Label>
                      <select value={planId} onChange={e => setPlanId(e.target.value)}
                              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {planes.map(p => <option key={p.id} value={p.id}>{p.nombre} · {p.dias} días</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Desde</Label>
                      <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
                    </div>
                  </div>
                  {plan && (
                    <p className="text-xs text-slate-500">
                      Este plan permite {plan.maxRegentes ?? "sin límite de"} regente{plan.maxRegentes === 1 ? "" : "s"} y{" "}
                      {plan.maxCajeros ?? "sin límite de"} cajero{plan.maxCajeros === 1 ? "" : "s"}.
                    </p>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Equipo inicial (opcional)</Label>
                      <div className="flex gap-1.5">
                        {(["cajero", "regente"] as Rol[]).map(r => (
                          <Button key={r} type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
                                  disabled={tope(r) !== null && cuenta(r) >= tope(r)!} onClick={() => sumarPersona(r)}>
                            <Plus className="h-3 w-3" />{r === "cajero" ? "Cajero" : "Regente"}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {excede && (
                      <p className="text-xs text-rose-600">
                        El plan permite hasta {tope(excede)} {excede === "regente" ? "regentes" : "cajeros"}.
                      </p>
                    )}
                    {equipo.length === 0 && <p className="text-xs text-slate-400">El dueño también puede crear su equipo después, desde Equipo.</p>}
                    {equipo.map((p, i) => (
                      <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-600">{p.rol === "cajero" ? "Cajero" : "Regente"}</span>
                          <button type="button" onClick={() => setEquipo(e => e.filter((_, n) => n !== i))}
                                  className="text-slate-300 hover:text-rose-600" title="Quitar">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Nombre" value={p.nombre} onChange={e => cambiarPersona(i, { nombre: e.target.value })} />
                          <Input placeholder="Correo" type="email" value={p.email} onChange={e => cambiarPersona(i, { email: e.target.value })} />
                        </div>
                        <Input className="font-mono" value={p.clave} onChange={e => cambiarPersona(i, { clave: e.target.value })}
                               placeholder="Contraseña inicial (mín. 8)" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" disabled={isPending}
                        onClick={() => (paso === 0 ? setOpen(false) : setPaso(p => p - 1))}>
                  {paso === 0 ? "Cancelar" : "Atrás"}
                </Button>
                {paso < 2 ? (
                  <Button className="flex-1" disabled={!pasoValido[paso]} onClick={() => { setError(null); setPaso(p => p + 1) }}>
                    Siguiente
                  </Button>
                ) : (
                  <Button className="flex-1" disabled={isPending || !pasoValido[2]} onClick={darDeAlta}>
                    {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Creando…</> : "Dar de alta"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
