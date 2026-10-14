"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CampoClaveInicial, CredencialesCreadas, generarClave } from "@/components/credenciales-iniciales"
import { crearUsuario } from "@/app/admin/actions"

/**
 * Alta de una cuenta desde el panel admin, con contraseña inicial. Queda
 * aprobada y activa; los portales y la membresía se asignan después desde la
 * tabla, como con cualquier usuario. Solo el superadmin puede crear admins.
 */
export function CrearUsuarioDialog({ esSuperadmin }: { esSuperadmin: boolean }) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [nombre, setNombre] = useState("")
  const [email, setEmail]   = useState("")
  const [clave, setClave]   = useState("")
  const [rol, setRol]       = useState<"user" | "admin">("user")
  const [error, setError]   = useState<string | null>(null)
  const [creada, setCreada] = useState<{ nombre: string; email: string; clave: string } | null>(null)
  const [isPending, start]  = useTransition()

  function abrir() {
    setNombre(""); setEmail(""); setRol("user"); setClave(generarClave())
    setError(null); setCreada(null); setOpen(true)
  }

  function crear() {
    setError(null)
    start(async () => {
      try {
        const r = await crearUsuario({ nombre, email, clave, rol })
        setCreada({ nombre: r.nombre, email: r.email, clave })
        router.refresh()
      } catch (e: any) { setError(e?.message ?? "No se pudo crear el usuario") }
    })
  }

  return (
    <>
      <Button onClick={abrir} className="gap-1.5">
        <UserPlus className="h-4 w-4" />Crear usuario
      </Button>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setCreada(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Crear usuario</DialogTitle></DialogHeader>
          {creada ? (
            <div className="mt-2">
              <CredencialesCreadas {...creada} onListo={() => { setOpen(false); setCreada(null) }} />
            </div>
          ) : (
            <div className="mt-2 space-y-4">
              {error && <p className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}
              <p className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
                La cuenta queda aprobada y activa. Después asígnale portales y membresía desde la tabla.
                Para sumar a alguien al equipo de una farmacia, lo hace el dueño desde Equipo.
              </p>
              <div className="space-y-1.5">
                <Label>Nombre completo</Label>
                <Input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Correo</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <CampoClaveInicial value={clave} onChange={setClave} />
              {esSuperadmin && (
                <div className="space-y-1.5">
                  <Label>Rol en la plataforma</Label>
                  <select value={rol} onChange={e => setRol(e.target.value as "user" | "admin")}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={crear}
                        disabled={isPending || !nombre.trim() || !email.trim() || clave.length < 8}>
                  {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Creando…</> : "Crear cuenta"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
