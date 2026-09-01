import * as React from 'react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

/**
 * The overflow menu.
 *
 * Built on the same `radix-ui` package as `alert-dialog.tsx`, so it inherits the
 * behaviour the product already relies on elsewhere: focus is trapped and restored,
 * Escape and outside-click close it, arrow keys and type-ahead move between items, and
 * the panel flips or shifts to stay on screen near a viewport edge — which is what a
 * hand-rolled absolutely-positioned div gets wrong on a phone.
 *
 * Styling comes from `theme/brand.ts` rather than the shadcn semantic tokens the older
 * `select.tsx` uses. Those tokens resolve to a greyscale ramp that predates the palette
 * consolidation, and a menu opened from a Jobblo card should match the card.
 */

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={12}
      className={cn(
        // `min-w-[11rem]` keeps the three labels on one line each; `max-w` stops a long
        // one stretching the panel across a phone.
        'z-50 min-w-[11rem] max-w-[16rem] overflow-hidden rounded-2xl border border-[#E6E7E1] bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(11,11,11,0.18)]',
        // Radix drives these from data-state. Short and small — the panel fades and
        // lifts a couple of pixels rather than scaling or sliding across the screen.
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 duration-150',
        'motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    /** Red text and a red highlight. For deletion only. */
    destructive?: boolean;
  }
>(({ className, destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      // 44px, the minimum comfortable touch target — the menu is the only way to reach
      // these actions on a phone, so the rows are sized for a thumb rather than a cursor.
      'relative flex h-11 cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 text-[0.875rem] font-medium outline-none transition-colors',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
      destructive
        ? 'text-[#B0453B] focus:bg-[#FCF4F3] data-[highlighted]:bg-[#FCF4F3]'
        : 'text-[#0B0B0B] focus:bg-[#F4F6F0] data-[highlighted]:bg-[#F4F6F0]',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1.5 my-1.5 h-px bg-[#E6E7E1]', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn('px-3 py-1.5 text-[0.75rem] font-medium leading-snug text-[#63665F]', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuPortal,
};
