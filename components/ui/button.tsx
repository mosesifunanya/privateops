import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400',
  {
    variants: {
      variant: {
        default:
          'bg-zinc-950 text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200',
        destructive:
          'bg-red-600 text-white shadow-sm hover:bg-red-700',
        outline:
          'border border-zinc-200 bg-white text-zinc-950 shadow-sm hover:bg-zinc-50 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900',
        secondary:
          'bg-zinc-100 text-zinc-950 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800',
        ghost:
          'hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-white',
        link:
          'text-zinc-950 underline-offset-4 hover:underline dark:text-white',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-xl px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants>) {
  return (
    <button
      className={cn(
        buttonVariants({
          variant,
          size,
          className,
        }),
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };