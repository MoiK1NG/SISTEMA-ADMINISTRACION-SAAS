import { requireClient } from "@/lib/supabase/require-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, Info } from "lucide-react"

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  approve_user:      { label: "Aprobar usuario",     color: "bg-emerald-100 text-emerald-700" },
  disapprove_user:   { label: "Desaprobar usuario",  color: "bg-amber-100 text-amber-700"     },
  toggle_active:     { label: "Activar/Suspender",   color: "bg-blue-100 text-blue-700"       },
  update_role:       { label: "Cambiar rol",          color: "bg-purple-100 text-purple-700"   },
  delete_user:       { label: "Eliminar usuario",     color: "bg-red-100 text-red-700"         },
  assign_membership: { label: "Asignar membresía",   color: "bg-sky-100 text-sky-700"         },
  create_portal:     { label: "Crear portal",         color: "bg-indigo-100 text-indigo-700"   },
  delete_portal:     { label: "Eliminar portal",      color: "bg-red-100 text-red-700"         },
  grant_access:      { label: "Dar acceso portal",    color: "bg-teal-100 text-teal-700"       },
  revoke_access:     { label: "Quitar acceso portal", color: "bg-orange-100 text-orange-700"   },
}

export default async function AuditPage() {
  const supabase = await requireClient()

  // Try to read audit_logs — table may not exist yet
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select(`id, action, entity_type, entity_name, details, created_at,
      admin:admin_id(full_name, email)`)
    .order("created_at", { ascending: false })
    .limit(100)

  const tableNotExists = error?.message?.includes("does not exist") || error?.code === "42P01"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6" /> Auditoría
        </h1>
        <p className="text-sm text-muted-foreground">Registro de acciones administrativas en la plataforma</p>
      </div>

      {tableNotExists && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5 flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Tabla de auditoría no configurada</p>
              <p className="text-sm text-amber-700 mt-1">
                Ejecuta el SQL del archivo <code className="bg-amber-100 px-1 rounded">supabase/audit_schema.sql</code> en tu proyecto de Supabase para habilitar el registro de auditoría.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!tableNotExists && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Últimas 100 acciones</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(!logs || logs.length === 0) ? (
              <div className="py-16 text-center text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay registros de auditoría aún</p>
                <p className="text-xs mt-1">Las acciones administrativas aparecerán aquí</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Admin</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Acción</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entidad</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log: any) => {
                      const actionMeta = ACTION_LABELS[log.action]
                      return (
                        <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-xs leading-none">{log.admin?.full_name || "—"}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{log.admin?.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${actionMeta?.color ?? "bg-gray-100 text-gray-700"}`}>
                              {actionMeta?.label ?? log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="font-medium capitalize">{log.entity_type}</span>
                            {log.entity_name && <span className="text-muted-foreground ml-1">· {log.entity_name}</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                            {log.details ? JSON.stringify(log.details) : "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
