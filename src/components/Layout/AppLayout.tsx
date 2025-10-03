"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import MainNav from "./MainNav";
import UserMenu from "./UserMenu";
import { Toaster } from "react-hot-toast";
import { KeyboardShortcutsDialog } from "@/components/Shared/KeyboardShortcuts";

interface AppLayoutProps {
  children: ReactNode;
}

const MINIMAL_ROUTES = new Set(["/login"]);

type ThemeOption = "light" | "dark";
type DensityOption = "comfortable" | "compact";

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const isMinimal = useMemo(() => MINIMAL_ROUTES.has(pathname ?? ""), [pathname]);
  const [theme, setTheme] = useState<ThemeOption>("light");
  const [density, setDensity] = useState<DensityOption>("comfortable");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("absd::theme") as ThemeOption | null;
    const storedDensity = window.localStorage.getItem("absd::density") as DensityOption | null;

    if (storedTheme) {
      setTheme(storedTheme);
    }
    if (storedDensity) {
      setDensity(storedDensity);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
    window.localStorage.setItem("absd::theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset['density'] = density;
    window.localStorage.setItem("absd::density", density);
  }, [density]);

  const toggleTheme = () => setTheme((value) => (value === "light" ? "dark" : "light"));
  const toggleDensity = () =>
    setDensity((value) => (value === "comfortable" ? "compact" : "comfortable"));

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      {!isMinimal && (
        <header className="border-b border-[var(--absd-border)] bg-[var(--absd-surface)] shadow-sm">
          <MainNav />

          <div className="border-t border-[var(--absd-border)] bg-[color-mix(in_oklab,var(--absd-surface) 94%,var(--absd-authority) 6%)]">
            <div className="absd-container">
              <div className="flex h-12 items-center justify-between gap-4">
                <span className="text-sm text-[rgba(15,23,42,0.65)]">
                  Sistema de Tesorería Nacional
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="rounded-full border border-[var(--absd-border)] px-3 py-1 text-xs font-semibold text-[var(--absd-ink)] transition hover:border-[var(--absd-authority)] hover:text-[var(--absd-authority)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--absd-authority)]"
                    aria-label="Cambiar tema"
                  >
                    Tema: {theme === "light" ? "Claro" : "Oscuro"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleDensity}
                    className="rounded-full border border-[var(--absd-border)] px-3 py-1 text-xs font-semibold text-[var(--absd-ink)] transition hover:border-[var(--absd-authority)] hover:text-[var(--absd-authority)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--absd-authority)]"
                    aria-label="Cambiar densidad"
                  >
                    Densidad: {density === "comfortable" ? "Cómoda" : "Compacta"}
                  </button>
                  <UserMenu />
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      <main id="main-content" className={isMinimal ? "py-12" : "py-8"}>
        <div className="absd-container">{children}</div>
      </main>

      {!isMinimal && (
        <footer className="border-t border-[var(--absd-border)] bg-[var(--absd-surface)]">
          <div className="absd-container py-4">
            <div className="flex flex-col items-start justify-between gap-2 text-sm text-[rgba(15,23,42,0.65)] md:flex-row md:items-center">
              <span>© {new Date().getFullYear()} IPU Paraguay — Todos los derechos reservados</span>
              <span>Sistema de Tesorería v2.0</span>
            </div>
          </div>
        </footer>
      )}

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#fff",
            color: "#363636",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />

      {!isMinimal && <KeyboardShortcutsDialog />}
    </div>
  );
}
