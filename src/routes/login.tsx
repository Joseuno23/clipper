import { Link, useNavigate } from "react-router";
import { useState } from "react";
import {
  Scissors,
  Building2,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthApiError, login, saveAuthSession } from "@/shared/api/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [tenant, setTenant] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login({
        barberShopSlug: tenant,
        email,
        password,
      });

      saveAuthSession({
        token: result.token,
        shopSlug: result.tenant.slug,
        remember,
      });

      setLoading(false);
      navigate("/dashboard");
    } catch (cause) {
      setLoading(false);
      setError(
        cause instanceof AuthApiError
          ? cause.message
          : "No pudimos iniciar sesión. Intentá nuevamente.",
      );
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left — form */}
        <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
          <Link to="/dashboard" className="inline-flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Scissors className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Clipper
            </span>
          </Link>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
            <div className="mb-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Acceso operadores
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
                Bienvenido de vuelta
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Ingresá a tu barbería para operar el día.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <Field
                label="Barbería"
                hint="Tu subdominio o slug del local"
                icon={<Building2 className="h-4 w-4" />}
                trailing={
                  <span className="pr-3 font-mono text-xs text-muted-foreground">
                    .clipper.app
                  </span>
                }
              >
                <input
                  value={tenant}
                  onChange={(e) => setTenant(e.target.value)}
                  placeholder="mi-barberia"
                  autoComplete="organization"
                  className="h-11 w-full bg-transparent pl-9 pr-28 text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </Field>

              <Field label="Email" icon={<Mail className="h-4 w-4" />}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@barberia.com"
                  autoComplete="email"
                  className="h-11 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </Field>

              <Field
                label="Contraseña"
                icon={<Lock className="h-4 w-4" />}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="pr-3 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPass ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                }
                action={
                  <button
                    type="button"
                    disabled
                    className="text-xs text-muted-foreground opacity-60"
                  >
                    ¿Olvidaste? Próximamente
                  </button>
                }
              >
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 w-full bg-transparent pl-9 pr-10 text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </Field>

              <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border bg-surface accent-primary"
                />
                Mantener sesión en este dispositivo
              </label>

              <Button
                type="submit"
                className="mt-2 h-11 w-full gap-2"
                disabled={loading}
              >
                {loading ? "Entrando…" : "Entrar"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    o
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface text-sm font-medium opacity-60"
              >
                <GoogleIcon className="h-4 w-4" />
                Continuar con Google · Próximamente
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              ¿Nueva barbería?{" "}
              <button
                type="button"
                disabled
                className="text-foreground opacity-60"
              >
                Solicitar acceso próximamente
              </button>
            </p>
          </div>

          <p className="mt-auto text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Clipper. Todos los derechos reservados.
          </p>
        </div>

        {/* Right — brand panel */}
        <div className="relative hidden overflow-hidden border-l border-border lg:block">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(1200px 600px at 80% -10%, oklch(0.35 0.08 260 / 0.6), transparent 60%), radial-gradient(900px 500px at 10% 110%, oklch(0.30 0.06 260 / 0.5), transparent 60%), linear-gradient(180deg, oklch(0.18 0.013 260), oklch(0.14 0.012 260))",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(oklch(1 0 0 / 0.6) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.6) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          <div className="relative flex h-full flex-col justify-between p-12">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="font-mono uppercase tracking-[0.2em]">
                Sistema operativo
              </span>
            </div>

            <div className="max-w-lg">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Plataforma multi-tenant
              </p>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight">
                Operá tu barbería como un producto premium.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Agenda, caja, staff, inventario y reportes en un solo lugar.
                Cada local aislado, cada equipo enfocado, cada turno bajo
                control.
              </p>

              <div className="mt-10 grid grid-cols-3 gap-4">
                <Stat label="Barberías" value="1.2k" />
                <Stat label="Turnos / mes" value="480k" />
                <Stat label="Uptime" value="99.98%" />
              </div>
            </div>

            <blockquote className="max-w-md border-l-2 border-primary/60 pl-4 text-sm text-muted-foreground">
              "Reemplazamos tres herramientas por Clipper. La caja cierra sola y
              el equipo ve su cola en tiempo real."
              <footer className="mt-2 text-xs">
                <span className="text-foreground">Martín Álvarez</span> ·
                Barbería Norte
              </footer>
            </blockquote>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  icon,
  trailing,
  action,
  children,
}: {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-xs font-medium text-foreground">{label}</label>
        {action}
      </div>
      <div className="relative flex items-center rounded-md border border-border bg-surface transition-colors focus-within:border-ring">
        <span className="pointer-events-none absolute left-3 text-muted-foreground">
          {icon}
        </span>
        {children}
        {trailing && (
          <span className="ml-auto flex items-center">{trailing}</span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface/60 p-3 backdrop-blur">
      <p className="font-display text-xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12S6.8 21.5 12 21.5c6.9 0 9.5-4.8 9.5-7.4 0-.5-.05-.9-.12-1.3H12z"
      />
    </svg>
  );
}
