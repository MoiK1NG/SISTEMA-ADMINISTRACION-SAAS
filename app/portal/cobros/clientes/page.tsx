import { requireClient } from "@/lib/supabase/require-client"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClientesCobroManager } from "./_components/clientes-cobro-manager"

export default async function ClientesCobroPage() {
  const supabase = await requireClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data } = await supabase
    .from("clientes_cobro")
    .select("id, nombre, cedula, telefono, direccion, cobros(id, estado)")
    .eq("agente_id", user.id)
    .order("nombre")

  const clientes = data ?? []
  const conCobros    = clientes.filter(c => c.cobros.length > 0).length
  const sinCobros    = clientes.filter(c => c.cobros.length === 0).length

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-slate-600">
            <Link href="/portal/cobros"><ArrowLeft className="h-4 w-4" />Cobros</Link>
          </Button>
          <div className="h-5 w-px bg-slate-200" />
          <Users className="h-5 w-5 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-900">Clientes</p>
          <div className="ml-auto text-[11px] text-slate-400">{clientes.length} clientes</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardContent className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{clientes.length}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardContent className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Con cobros</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{conCobros}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardContent className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Sin cobros</p>
              <p className="mt-1 text-2xl font-bold text-slate-400">{sinCobros}</p>
            </CardContent>
          </Card>
        </div>

        <ClientesCobroManager clientes={clientes as any} />
      </main>
    </div>
  )
}
