import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-10 max-w-sm w-full text-center space-y-5 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 mx-auto">
          <AlertCircle className="h-7 w-7 text-rose-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">No pudimos validar el enlace</h1>
          <p className="mt-2 text-sm text-slate-500">
            El enlace ya venció, se usó antes o está incompleto. Solicita uno nuevo para continuar.
          </p>
        </div>
        <div className="space-y-2.5">
          <Button asChild className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700">
            <Link href="/forgot-password">Solicitar enlace nuevo</Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-11 rounded-xl border-slate-200 font-medium text-sm text-slate-700 hover:bg-slate-50">
            <Link href="/login">Volver a iniciar sesión</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
