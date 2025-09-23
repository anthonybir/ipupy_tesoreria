"use client";

import { Fragment } from "react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { Menu, Transition } from "@headlessui/react";
import {
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

export default function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="animate-pulse">
        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <Menu as="div" className="relative">
      <div>
        <Menu.Button className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          <span className="sr-only">Abrir menú de usuario</span>
          {typeof session.user?.image === "string" && session.user.image.length > 0 ? (
            <Image
              className="h-8 w-8 rounded-full"
              src={session.user.image}
              alt="Foto de perfil"
              width={32}
              height={32}
              priority
            />
          ) : (
            <UserCircleIcon className="h-8 w-8 text-gray-400" />
          )}
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
        <Menu.Items className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="py-1">
            <div className="px-4 py-2 text-xs text-gray-500">
              Conectado como
            </div>
            <div className="px-4 py-2">
              <p className="text-sm font-medium text-gray-900">
                {session.user?.name || "Usuario"}
              </p>
              <p className="text-xs text-gray-500">{session.user?.email}</p>
            </div>
            <hr className="my-1" />

            <Menu.Item>
              {({ active }) => (
                <a
                  href="/profile"
                  className={`${
                    active ? "bg-gray-100" : ""
                  } flex px-4 py-2 text-sm text-gray-700`}
                >
                  <UserIcon className="mr-3 h-5 w-5" aria-hidden="true" />
                  Mi Perfil
                </a>
              )}
            </Menu.Item>

            <Menu.Item>
              {({ active }) => (
                <a
                  href="/settings"
                  className={`${
                    active ? "bg-gray-100" : ""
                  } flex px-4 py-2 text-sm text-gray-700`}
                >
                  <Cog6ToothIcon className="mr-3 h-5 w-5" aria-hidden="true" />
                  Configuración
                </a>
              )}
            </Menu.Item>

            <hr className="my-1" />

            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => signOut()}
                  className={`${
                    active ? "bg-gray-100" : ""
                  } flex w-full px-4 py-2 text-sm text-gray-700`}
                >
                  <ArrowRightOnRectangleIcon
                    className="mr-3 h-5 w-5"
                    aria-hidden="true"
                  />
                  Cerrar Sesión
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}