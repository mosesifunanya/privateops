'use client';

import * as React from 'react';
import {
  Tooltip as TooltipPrimitive,
} from '@base-ui/react/tooltip';

import { cn } from '@/lib/utils';

function TooltipProvider({
  children,
  delay = 0,
  closeDelay = 0,
  timeout = 0,
}: {
  children: React.ReactNode;
  delay?: number;
  closeDelay?: number;
  timeout?: number;
}) {
  return (
    <TooltipPrimitive.Provider
      delay={delay}
      closeDelay={closeDelay}
      timeout={timeout}
    >
      {children}
    </TooltipPrimitive.Provider>
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />;
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<
  typeof TooltipPrimitive.Trigger
>) {
  return (
    <TooltipPrimitive.Trigger {...props} />
  );
}

function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<
  typeof TooltipPrimitive.Popup
> & {
  sideOffset?: number;
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        sideOffset={sideOffset}
        className="z-50"
      >
        <TooltipPrimitive.Popup
          className={cn(
            'rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-medium text-white shadow-xl dark:bg-white dark:text-zinc-950',
            className,
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
};