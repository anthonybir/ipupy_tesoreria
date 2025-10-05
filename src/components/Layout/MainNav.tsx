"use client";

import type { JSX } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ForwardRefExoticComponent, type SVGProps } from "react";
import {
  ChartBarIcon,
  DocumentTextIcon,
  BookOpenIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  Bars3Icon,
  XMarkIcon,
  Cog6ToothIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "@/components/Auth/SupabaseAuthProvider";
import { useProfile } from "@/hooks/useProfile";

type NavItem = {
  name: string;
  href: string;
  icon: ForwardRefExoticComponent<SVGProps<SVGSVGElement>>;
};

const NAVIGATION: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: ChartBarIcon,
  },
  {
    name: "Informes",
    href: "/reports",
    icon: DocumentTextIcon,
  },
  {
    name: "Libro Mensual",
    href: "/ledger",
    icon: BookOpenIcon,
  },
  {
    name: "Fondos",
    href: "/funds",
    icon: BanknotesIcon,
  },
  {
    name: "Eventos",
    href: "/fund-director/events",
    icon: CalendarIcon,
  },
  {
    name: "Proveedores",
    href: "/providers",
    icon: UserGroupIcon,
  },
  {
    name: "Iglesias",
    href: "/churches",
    icon: BuildingLibraryIcon,
  },
  {
    name: "Exportar",
    href: "/export",
    icon: ArrowDownTrayIcon,
  },
] as const;

export default function MainNav(): JSX.Element {
  const pathname = usePathname();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const authRole =
    (user?.app_metadata['role'] as string | undefined) ??
    (user?.user_metadata['role'] as string | undefined) ??
    (user ? (user as { role?: string }).role : undefined);

  const items = useMemo(() => {
    const role = profile?.role ?? authRole;

    let items = NAVIGATION.filter(item => {
      if (item.name === 'Eventos') {
        // National-level roles + fund_director can access events
        return role === 'admin' || role === 'national_treasurer' || role === 'treasurer' || role === 'fund_director';
      }
      if (item.name === 'Proveedores') {
        // National-level roles can access providers
        return role === 'admin' || role === 'national_treasurer' || role === 'treasurer';
      }
      return true;
    });

    if (role === 'admin') {
      items = [...items, { name: 'Configuración', href: '/admin/configuration', icon: Cog6ToothIcon }];
    }

    return items;
  }, [profile?.role, authRole]);

  const toggleMobileMenu = () => setMobileMenuOpen((open) => !open);

  return (
    <nav aria-label="Principal" className="border-b border-[var(--absd-border)] bg-[var(--absd-surface)]">
      <div className="absd-container hidden h-16 items-center justify-between md:flex">
        <Link href="/" className="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--absd-authority)] text-sm font-semibold text-white">
            IPU
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-[var(--absd-ink)]">Tesorería Nacional</span>
            <span className="text-xs text-[rgba(15,23,42,0.6)]">IPU Paraguay</span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)] ${
                  isActive
                    ? "bg-[var(--absd-authority)] text-white shadow"
                    : "text-[rgba(15,23,42,0.7)] hover:bg-[color-mix(in_oklab,var(--absd-authority) 8%,white)] hover:text-[var(--absd-ink)]"
                }`}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="absd-container flex h-16 items-center justify-between md:hidden">
        <Link
          href="/"
          className="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--absd-authority)] text-xs font-semibold text-white">
            IPU
          </span>
          <span className="flex flex-col">
            <span className="text-base font-semibold text-[var(--absd-ink)]">Tesorería</span>
            <span className="text-xs text-[rgba(15,23,42,0.6)]">IPU Paraguay</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={toggleMobileMenu}
          className="inline-flex items-center justify-center rounded-full border border-[var(--absd-border)] p-2 text-[rgba(15,23,42,0.7)] transition hover:border-[var(--absd-authority)] hover:text-[var(--absd-authority)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]"
          aria-controls="mobile-navigation"
          aria-expanded={mobileMenuOpen}
        >
          <span className="sr-only">Abrir menú principal</span>
          {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" aria-hidden="true" /> : <Bars3Icon className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-navigation" className="border-t border-[var(--absd-border)] bg-[var(--absd-surface)] md:hidden">
          <ul className="space-y-1 px-4 py-3" role="list">
            {items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)] ${
                      isActive
                        ? "bg-[color-mix(in_oklab,var(--absd-authority) 18%,white)] text-[var(--absd-authority)]"
                        : "text-[rgba(15,23,42,0.7)] hover:bg-[color-mix(in_oklab,var(--absd-authority) 12%,white)] hover:text-[var(--absd-ink)]"
                    }`}
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
