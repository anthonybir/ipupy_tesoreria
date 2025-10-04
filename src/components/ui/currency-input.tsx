import * as React from 'react';

import { Input, type InputProps } from '@/components/ui/input';
import {
  CURRENCY_SUFFIX,
  formatCurrencyInput,
  parseCurrencyInput,
} from '@/lib/utils/currency';

type CurrencyInputProps = Omit<InputProps, 'value' | 'onChange' | 'type' | 'inputMode' | 'pattern'> & {
  value: string;
  onValueChange: (rawValue: string) => void;
};

const digitCount = (value: string): number => value.replace(/[^0-9]/g, '').length;

const getNumericSegment = (formattedValue: string): string => {
  const suffixIndex = formattedValue.indexOf(CURRENCY_SUFFIX);
  return suffixIndex === -1 ? formattedValue : formattedValue.slice(0, suffixIndex);
};

const computeCaretPosition = (formattedValue: string, digitsToLeft: number): number => {
  if (digitsToLeft <= 0) {
    return 0;
  }

  const numericSegment = getNumericSegment(formattedValue);
  let digitsSeen = 0;

  for (let index = 0; index < numericSegment.length; index += 1) {
    if (/\d/.test(numericSegment[index] ?? '')) {
      digitsSeen += 1;
      if (digitsSeen >= digitsToLeft) {
        return index + 1;
      }
    }
  }

  return numericSegment.length;
};

const clampCaretToSuffix = (formattedValue: string, caret: number): number => {
  const suffixIndex = formattedValue.indexOf(CURRENCY_SUFFIX);
  if (suffixIndex === -1) {
    return caret;
  }
  return Math.min(caret, suffixIndex);
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, ...rest }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const pendingCaret = React.useRef<number | null>(null);

    const { onFocus: onFocusProp, onPointerUp: onPointerUpProp, ...restProps } = rest;

    const combinedRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );

    const formattedValue = React.useMemo(() => formatCurrencyInput(value), [value]);

    const enforceSelectionBeforeSuffix = React.useCallback(
      (target: HTMLInputElement) => {
        const suffixIndex = formattedValue.indexOf(CURRENCY_SUFFIX);
        if (suffixIndex === -1) {
          return;
        }

        const applyClamp = () => {
          const selectionStart = target.selectionStart ?? 0;
          const selectionEnd = target.selectionEnd ?? 0;

          if (selectionStart >= suffixIndex && selectionEnd >= suffixIndex) {
            target.setSelectionRange(suffixIndex, suffixIndex);
          } else if (selectionEnd > suffixIndex) {
            target.setSelectionRange(selectionStart, suffixIndex);
          }
        };

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(applyClamp);
        } else {
          setTimeout(applyClamp, 0);
        }
      },
      [formattedValue]
    );

    const handleChange = React.useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const { value: inputValue } = event.target;
        const selectionStart = event.target.selectionStart ?? inputValue.length;
        const digitsToLeft = digitCount(inputValue.slice(0, selectionStart));
        const nextRawValue = parseCurrencyInput(inputValue);
        const nextFormattedValue = formatCurrencyInput(nextRawValue);
        const desiredCaret = clampCaretToSuffix(
          nextFormattedValue,
          computeCaretPosition(nextFormattedValue, digitsToLeft)
        );

        pendingCaret.current = desiredCaret;
        onValueChange(nextRawValue);
      },
      [onValueChange]
    );

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!inputRef.current) {
        return;
      }

      const suffixIndex = formattedValue.indexOf(CURRENCY_SUFFIX);
      if (suffixIndex === -1) {
        return;
      }

      const selectionStart = inputRef.current.selectionStart ?? 0;
      const selectionEnd = inputRef.current.selectionEnd ?? 0;
      const selectionAtOrBeyondSuffix = selectionStart >= suffixIndex && selectionEnd >= suffixIndex;
      const selectionPastSuffix = selectionStart > suffixIndex || selectionEnd > suffixIndex;

      if (selectionAtOrBeyondSuffix) {
        if (event.key === 'ArrowRight' || event.key === 'End') {
          pendingCaret.current = suffixIndex;
          event.preventDefault();
        } else if (event.key === 'ArrowLeft') {
          pendingCaret.current = suffixIndex;
        } else if (event.key === 'Delete') {
          pendingCaret.current = suffixIndex;
          event.preventDefault();
        } else if (event.key === 'Backspace' && selectionPastSuffix) {
          pendingCaret.current = suffixIndex;
          event.preventDefault();
        }
      }
    }, [formattedValue]);

    const handleFocus = React.useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        enforceSelectionBeforeSuffix(event.currentTarget);
        onFocusProp?.(event);
      },
      [enforceSelectionBeforeSuffix, onFocusProp]
    );

    const handlePointerUp = React.useCallback(
      (event: React.PointerEvent<HTMLInputElement>) => {
        enforceSelectionBeforeSuffix(event.currentTarget);
        onPointerUpProp?.(event);
      },
      [enforceSelectionBeforeSuffix, onPointerUpProp]
    );

    React.useLayoutEffect(() => {
      if (!inputRef.current || pendingCaret.current === null) {
        return;
      }

      if (document.activeElement !== inputRef.current) {
        pendingCaret.current = null;
        return;
      }

      const caretPosition = clampCaretToSuffix(formattedValue, pendingCaret.current);
      const safePosition = Math.min(caretPosition, formattedValue.length);
      inputRef.current.setSelectionRange(safePosition, safePosition);
      pendingCaret.current = null;
    }, [formattedValue]);

    return (
      <Input
        ref={combinedRef}
        value={formattedValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onPointerUp={handlePointerUp}
        inputMode="decimal"
        type="text"
        className={className}
        autoComplete="off"
        {...restProps}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
