import Link from "next/link";

export default function NotFound(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-slate-100 p-8 text-center">
      <h1 className="text-3xl font-semibold">Página no encontrada</h1>
      <p>La ruta solicitada no existe dentro del panel de Tesorería.</p>
      <Link
        href="/"
        className="rounded bg-emerald-500 px-4 py-2 font-medium text-white transition hover:bg-emerald-600"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
