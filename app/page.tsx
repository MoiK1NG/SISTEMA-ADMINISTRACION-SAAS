import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Building2, Users, LayoutDashboard, Shield } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* Encabezado */}
      <header className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <span className="font-semibold text-lg">Portal Empresarial</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Comenzar</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Sección Hero */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            Plataforma Multi-Portal para Emprendedores
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Administra usuarios, membresías y controla el acceso a múltiples portales empresariales desde un único panel de administración.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/signup">Prueba Gratuita</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
          </div>
        </section>

        {/* Sección de Características */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Gestión de Usuarios</h3>
              <p className="text-gray-600">
                Administra usuarios con control de acceso basado en roles. Aprueba, activa y asigna membresías fácilmente.
              </p>
            </div>
            <div className="text-center p-6 rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <LayoutDashboard className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Múltiples Portales</h3>
              <p className="text-gray-600">
                Accede a múltiples herramientas empresariales incluyendo E-Commerce, CRM, Analíticas y portales de Marketing.
              </p>
            </div>
            <div className="text-center p-6 rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Acceso Seguro</h3>
              <p className="text-gray-600">
                Planes de membresía flexibles con expiración automática y control granular de acceso a portales.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Pie de página */}
      <footer className="border-t border-gray-200 bg-gray-50 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; 2024 Portal Empresarial. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
