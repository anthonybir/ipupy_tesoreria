"use client";

import { Fragment, type JSX } from "react";
import { useAuth } from "@/components/Auth/SupabaseAuthProvider";
import { Menu, Transition } from "@headlessui/react";
import {
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

export default function UserMenu(): JSX.Element | null {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Menu as="div" className="relative">
      <div>
        <Menu.Button className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          <span className="sr-only">Abrir menú de usuario</span>
          <UserCircleIcon className="h-8 w-8 text-gray-400" />
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="px-4 py-3">
            <p className="text-sm">Conectado como</p>
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.email}
            </p>
          </div>
          <div className="border-t border-gray-200" />
          <Menu.Item>
            {({ active }) => (
              <a
                href="/admin/configuration"
                className={`${
                  active ? "bg-gray-100" : ""
                } flex items-center px-4 py-2 text-sm text-gray-700`}
              >
                <Cog6ToothIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                Configuración
              </a>
            )}
          </Menu.Item>
          <div className="border-t border-gray-200" />
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={() => signOut()}
                className={`${
                  active ? "bg-gray-100" : ""
                } flex w-full items-center px-4 py-2 text-sm text-gray-700`}
              >
                <ArrowRightOnRectangleIcon
                  className="mr-3 h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
                Cerrar sesión
              </button>
            )}
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}