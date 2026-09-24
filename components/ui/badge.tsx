import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-zinc-950 text-white dark:bg-white dark:text-zinc-950',
        secondary:
          'border-transparent bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
        destructive:
          'border-transparent bg-red-600 text-white',
        outline:
          'border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(
        badgeVariants({
          variant,
          className,
        }),
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };