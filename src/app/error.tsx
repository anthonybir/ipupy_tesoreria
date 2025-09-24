"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Global error captured:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-red-950 text-red-50 p-8 text-center">
      <h1 className="text-3xl font-semibold">Ocurrió un error inesperado</h1>
      <p>Intenta recargar la página o vuelve al inicio mientras investigamos el problema.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded bg-red-500 px-4 py-2 font-medium text-white transition hover:bg-red-600"
      >
        Reintentar
      </button>
    </main>
  );
}
