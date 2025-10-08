# PR Comparison: Currency Input Caret Clamping

This note reviews the two open pull requests that aim to prevent the caret from moving behind the `Gs.` currency suffix in `src/components/ui/currency-input.tsx`.

## Baseline Behavior

The existing component clamps the caret during keyboard interactions (`ArrowRight`, `End`, `Delete`, etc.) and when React reapplies the formatted value, but it does **not** intercept focus or pointer events. As a result, users can click after the suffix and continue typing in the wrong position.

## PR #1 – `codex/fix-cursor-placement-in-text-box`

**Key ideas**

- Adds `ensureCaretBeforeSuffix(target)` that inspects the current selection and repositions it with `clampCaretToSuffix` after focus or pointer events.
- Invokes that helper inside `requestAnimationFrame` callbacks attached to `onFocus` and `onPointerUp`.
- For collapsed selections, it repositions the caret; for ranged selections it trims the end of the selection back to the suffix and keeps the start index intact.

**Observations**

- The handler overrides `onFocus`/`onPointerUp` without calling any props supplied by consumers, which would break parent components that rely on those events.
- There is no fallback when `requestAnimationFrame` is unavailable (e.g., in certain Jest environments), so tests that run in non-browser contexts may fail without extra shims.
- The helper closes over `formattedValue`, so the clamping logic stays consistent with the rendered value.

## PR #2 – `codex/fix-cursor-placement-in-text-box-ocw6tw`

**Key ideas**

- Extracts `onFocus` and `onPointerUp` from the rest props, wraps them, and still forwards the original handlers.
- Centralizes the caret adjustment in `enforceSelectionBeforeSuffix`, which requests an animation frame (or falls back to `setTimeout(0)`) before clamping the current selection to the suffix boundary.
- Uses simple guard clauses to snap a collapsed caret to the suffix or trim only the end of a ranged selection that bleeds past the suffix.

**Observations**

- Preserves consumer-supplied `onFocus` and `onPointerUp` callbacks, preventing regressions in composed inputs.
- Provides a non-rAF fallback so the logic runs even in environments without `requestAnimationFrame`.
- The destructured `restProps` still passes every other prop through to the underlying `<Input>`.

## Recommendation

PR #2 is the safer choice. It matches PR #1's user-facing fix, but it also keeps downstream event handlers intact and covers non-browser runtimes with a graceful fallback. PR #1 would unintentionally swallow `onFocus`/`onPointerUp` props, creating subtle integration bugs.
