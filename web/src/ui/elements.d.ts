import type { HTMLAttributes, RefAttributes } from 'react';

/** Custom elements registered by `@alllexey/ui/elements` (imported once in `main.tsx`). */
type Element<Attributes> = HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement> & Attributes;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'm3-shape': Element<{ shape?: string; size?: number | string; color?: string }>;
      'm3-loading-indicator': Element<{
        size?: number | string;
        contained?: boolean;
        label?: string;
      }>;
      'm3-progress': Element<{
        value?: number | string;
        max?: number | string;
        tone?: 'primary' | 'warning' | 'error' | 'tertiary';
        flat?: boolean;
        thickness?: number | string;
      }>;
    }
  }
}
