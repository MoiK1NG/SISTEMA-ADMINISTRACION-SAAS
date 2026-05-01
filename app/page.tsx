import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Building2, Users, LayoutDashboard, Shield } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Business Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-balance">
            Multi-Portal Entrepreneurship Platform
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
            Manage users, memberships, and control access to multiple business portals from a single admin dashboard.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/signup">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg border bg-card">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">User Management</h3>
              <p className="text-muted-foreground">
                Manage users with role-based access control. Approve, activate, and assign memberships easily.
              </p>
            </div>
            <div className="text-center p-6 rounded-lg border bg-card">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <LayoutDashboard className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Multiple Portals</h3>
              <p className="text-muted-foreground">
                Access multiple business tools including E-Commerce, CRM, Analytics, and Marketing portals.
              </p>
            </div>
            <div className="text-center p-6 rounded-lg border bg-card">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Secure Access</h3>
              <p className="text-muted-foreground">
                Flexible membership plans with automatic expiration and granular portal access control.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Business Portal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
