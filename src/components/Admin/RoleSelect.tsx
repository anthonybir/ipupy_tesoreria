"use client";

import type { JSX } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfileRole } from "@/lib/authz";

type RoleOption = {
  value: ProfileRole;
  label: string;
  description: string;
};

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "admin",
    label: "Administrador (Nacional)",
    description: "Acceso total. Gestiona configuración, usuarios y aprobaciones.",
  },
  {
    value: "treasurer",
    label: "Tesorero Nacional ⚠️",
    description: "Controla finanzas nacionales y aprueba reportes de todas las iglesias.",
  },
  {
    value: "fund_director",
    label: "Director de Fondos",
    description: "Gestiona eventos y ejecución de fondos nacionales asignados.",
  },
  {
    value: "pastor",
    label: "Pastor (+ finanzas locales)",
    description: "Crea reportes y administra transacciones de su iglesia.",
  },
  {
    value: "church_manager",
    label: "Gerente de Iglesia",
    description: "Acceso administrador solo lectura para la iglesia asignada.",
  },
  {
    value: "secretary",
    label: "Secretario",
    description: "Soporte administrativo. Captura datos y consulta reportes locales.",
  },
];

export type RoleSelectProps = {
  value: ProfileRole;
  onChange: (role: ProfileRole) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
};

export function RoleSelect({ value, onChange, disabled = false, placeholder, id }: RoleSelectProps): JSX.Element {
  return (
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue as ProfileRole)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder ?? "Seleccionar rol"} />
      </SelectTrigger>
      <SelectContent>
        {ROLE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium leading-tight">{option.label}</span>
              <span className="text-xs text-[rgba(15,23,42,0.65)]">{option.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
