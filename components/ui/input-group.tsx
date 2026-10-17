"use client";

import * as React from "react";
import { cn } from "cn";

const InputGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="input-group"
    className={cn(
      "relative flex items-center rounded-lg border border-input bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
      className
    )}
    {...props}
  />
));
InputGroup.displayName = "InputGroup";

const InputGroupAddon = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { align?: "inline-start" | "inline-end" }
>(({ className, align = "inline-start", ...props }, ref) => (
  <div
    ref={ref}
    data-slot="input-group-addon"
    data-align={align}
    className={cn(
      "flex items-center text-muted-foreground select-none",
      align === "inline-start" ? "pl-2.5 pr-1" : "pl-1 pr-2.5",
      className
    )}
    {...props}
  />
));
InputGroupAddon.displayName = "InputGroupAddon";

const InputGroupInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    data-slot="input-group-input"
    className={cn(
      "flex h-full w-full bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
InputGroupInput.displayName = "InputGroupInput";

export { InputGroup, InputGroupAddon, InputGroupInput };
