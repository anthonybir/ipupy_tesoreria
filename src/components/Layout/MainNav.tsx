"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChartBarIcon,
  DocumentTextIcon,
  BookOpenIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ArrowDownTrayIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const navigation = [
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
    name: "Iglesias",
    href: "/churches",
    icon: BuildingLibraryIcon,
  },
  {
    name: "Exportar",
    href: "/export",
    icon: ArrowDownTrayIcon,
  },
];

export default function MainNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                    IPU
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">Tesorería Nacional</h1>
                    <p className="text-xs text-gray-500">IPU Paraguay</p>
                  </div>
                </Link>
              </div>

              {/* Navigation Links */}
              <div className="hidden md:ml-10 md:flex md:space-x-2">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`
                        inline-flex items-center px-3 py-2 text-sm font-medium rounded-md
                        transition-colors duration-150
                        ${
                          isActive
                            ? "bg-indigo-100 text-indigo-700"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }
                      `}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  IPU
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900">Tesorería</h1>
                  <p className="text-xs text-gray-500">IPU Paraguay</p>
                </div>
              </Link>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="sr-only">Abrir menú principal</span>
              {mobileMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      block px-4 py-2 text-base font-medium
                      ${
                        isActive
                          ? "bg-indigo-50 border-l-4 border-indigo-500 text-indigo-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }
                    `}
                  >
                    <div className="flex items-center">
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}