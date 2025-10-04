'use client';

import { Fragment, type MutableRefObject, type ReactNode, type JSX } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

import { cn } from '@/lib/utils/cn';

export type DrawerPosition = 'right' | 'left' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'full';

const sizeClassNames: Record<DrawerSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  full: 'max-w-screen-md sm:max-w-screen-lg lg:max-w-screen-xl',
};

const positionClassNames: Record<DrawerPosition, string> = {
  right: 'inset-y-0 right-0 flex max-w-full pl-10',
  left: 'inset-y-0 left-0 flex max-w-full pr-10',
  bottom: 'inset-x-0 bottom-0 flex w-full items-end justify-center px-4',
};

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  position?: DrawerPosition;
  size?: DrawerSize;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  initialFocus?: MutableRefObject<HTMLElement | null>;
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  position = 'right',
  size = 'md',
  footer,
  children,
  className,
  initialFocus,
}: DrawerProps): JSX.Element {
  const sidePanelClass = cn(
    'pointer-events-auto w-screen bg-[var(--absd-surface)] shadow-xl transition-all',
    sizeClassNames[size],
    position === 'bottom' && 'rounded-t-3xl',
    position !== 'bottom' && 'rounded-l-3xl',
    className,
  );

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={onClose}
        {...(initialFocus ? { initialFocus } : {})}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className={cn('absolute', positionClassNames[position])}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom={position === 'bottom' ? 'translate-y-full opacity-0' : 'translate-x-full opacity-0'}
              enterTo="translate-x-0 translate-y-0 opacity-100"
              leave="ease-in duration-150"
              leaveFrom="translate-x-0 translate-y-0 opacity-100"
              leaveTo={position === 'bottom' ? 'translate-y-full opacity-0' : 'translate-x-full opacity-0'}
            >
              <Dialog.Panel className={sidePanelClass}>
                <div className="flex h-full flex-col">
                  <header className="flex items-start justify-between gap-4 border-b border-[var(--absd-border)] px-6 py-4">
                    <div className="space-y-1">
                      {title ? (
                        <Dialog.Title className="text-lg font-semibold text-[var(--absd-ink)]">
                          {title}
                        </Dialog.Title>
                      ) : null}
                      {description ? (
                        <Dialog.Description className="text-sm text-[rgba(15,23,42,0.6)]">
                          {description}
                        </Dialog.Description>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center justify-center rounded-full border border-[var(--absd-border)] p-2 text-sm font-semibold text-[rgba(15,23,42,0.7)] transition hover:border-[var(--absd-authority)] hover:text-[var(--absd-authority)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--absd-authority)]"
                    >
                      <span className="sr-only">Cerrar panel</span>
                      <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </header>

                  <div className="flex-1 overflow-y-auto px-6 py-5" data-slot="drawer-body">
                    {children}
                  </div>

                  {footer ? (
                    <footer className="border-t border-[var(--absd-border)] px-6 py-4" data-slot="drawer-footer">
                      {footer}
                    </footer>
                  ) : null}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
