'use client';

import { useEffect, useState, type JSX } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type Shortcut = {
  key: string;
  label: string;
  description: string;
  category: string;
};

const shortcuts: Shortcut[] = [
  // Navigation
  { key: 'g h', label: 'Ir a Inicio', description: 'Navegar al dashboard', category: 'Navegación' },
  { key: 'g i', label: 'Ir a Iglesias', description: 'Ver directorio de iglesias', category: 'Navegación' },
  { key: 'g r', label: 'Ir a Reportes', description: 'Centro de informes', category: 'Navegación' },
  { key: 'g f', label: 'Ir a Fondos', description: 'Gestión de fondos', category: 'Navegación' },
  { key: 'g l', label: 'Ir a Libro', description: 'Libro mensual', category: 'Navegación' },

  // Actions
  { key: '/', label: 'Buscar', description: 'Activar búsqueda', category: 'Acciones' },
  { key: 'n', label: 'Nuevo', description: 'Crear nuevo registro', category: 'Acciones' },
  { key: 'e', label: 'Editar', description: 'Editar seleccionado', category: 'Acciones' },
  { key: 'r', label: 'Refrescar', description: 'Actualizar datos', category: 'Acciones' },

  // UI
  { key: '?', label: 'Ayuda', description: 'Mostrar atajos', category: 'Interfaz' },
  { key: 'Esc', label: 'Cerrar', description: 'Cerrar modal/drawer', category: 'Interfaz' },
  { key: 't', label: 'Tema', description: 'Cambiar tema claro/oscuro', category: 'Interfaz' },
  { key: 'd', label: 'Densidad', description: 'Cambiar densidad', category: 'Interfaz' },
];

export function useKeyboardShortcuts(): { showHelp: boolean; setShowHelp: React.Dispatch<React.SetStateAction<boolean>> } {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    let sequence = '';
    let sequenceTimer: NodeJS.Timeout;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      // Show help with ?
      if (key === '?' && !event.shiftKey) {
        event.preventDefault();
        setShowHelp(true);
        return;
      }

      // Close with Escape
      if (key === 'escape') {
        setShowHelp(false);
        return;
      }

      // Handle sequences (like "g h")
      if (key === 'g') {
        sequence = 'g';
        clearTimeout(sequenceTimer);
        sequenceTimer = setTimeout(() => {
          sequence = '';
        }, 1000);
        event.preventDefault();
        return;
      }

      // Navigation shortcuts
      if (sequence === 'g') {
        clearTimeout(sequenceTimer);
        sequence = '';
        event.preventDefault();

        switch (key) {
          case 'h':
            window.location.href = '/';
            break;
          case 'i':
            window.location.href = '/churches';
            break;
          case 'r':
            window.location.href = '/reports';
            break;
          case 'f':
            window.location.href = '/funds';
            break;
          case 'l':
            window.location.href = '/ledger';
            break;
        }
        return;
      }

      // Single-key shortcuts
      switch (key) {
        case '/':
          event.preventDefault();
          // Focus search input if exists
          const searchInput = document.querySelector<HTMLInputElement>('input[type="search"], input[name="search"]');
          searchInput?.focus();
          break;

        case 'r':
          if (event.ctrlKey || event.metaKey) {
            return; // Allow browser refresh
          }
          event.preventDefault();
          // Trigger refetch (could dispatch custom event)
          window.dispatchEvent(new CustomEvent('shortcut:refresh'));
          break;

        case 't':
          event.preventDefault();
          // Toggle theme
          {
            const currentTheme = document.documentElement.dataset['theme'];
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset['theme'] = nextTheme;
            window.localStorage.setItem('absd::theme', nextTheme);
          }
          break;

        case 'd':
          event.preventDefault();
          // Toggle density
          {
            const currentDensity = document.documentElement.dataset['density'];
            const nextDensity = currentDensity === 'compact' ? 'comfortable' : 'compact';
            document.documentElement.dataset['density'] = nextDensity;
            window.localStorage.setItem('absd::density', nextDensity);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(sequenceTimer);
    };
  }, []);

  return { showHelp, setShowHelp };
}

export function KeyboardShortcutsDialog(): JSX.Element {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  const categories = Array.from(new Set(shortcuts.map((s) => s.category)));

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atajos de Teclado</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold text-[var(--absd-ink)]">{category}</h3>
              <div className="space-y-2">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between rounded-lg border border-[var(--absd-border)] bg-[var(--absd-subtle)] px-4 py-2"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-[var(--absd-ink)]">{shortcut.label}</div>
                        <div className="text-xs text-[rgba(15,23,42,0.65)]">{shortcut.description}</div>
                      </div>
                      <kbd className="inline-flex items-center gap-1 rounded border border-[var(--absd-border)] bg-[var(--absd-surface)] px-2 py-1 text-xs font-mono font-semibold text-[var(--absd-ink)] shadow-sm">
                        {shortcut.key.split(' ').map((k, i) => (
                          <span key={i}>
                            {i > 0 && <span className="mx-1 text-[rgba(15,23,42,0.4)]">then</span>}
                            {k}
                          </span>
                        ))}
                      </kbd>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-center text-[rgba(15,23,42,0.55)]">
            Presiona <kbd className="rounded border border-[var(--absd-border)] bg-[var(--absd-subtle)] px-1.5 py-0.5 text-xs font-mono">?</kbd> en cualquier momento para ver esta ayuda
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}