"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  DayPicker,
  type DayPickerProps,
  getDefaultClassNames,
} from "react-day-picker";
import { tr } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

import "react-day-picker/style.css";

export type CalendarProps = DayPickerProps & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  components,
  locale = tr,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("w-fit rounded-xl p-3 [--cell-size:2.25rem]", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months,
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1 px-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 shrink-0 select-none rounded-lg border border-input p-0 aria-disabled:opacity-40",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-7 w-7 shrink-0 select-none rounded-lg border border-input p-0 aria-disabled:opacity-40",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-[--cell-size] w-full items-center justify-center px-[--cell-size]",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-[--cell-size] w-full items-center justify-center gap-2 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "relative rounded-lg border border-border/60 bg-muted/30 shadow-sm has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          "absolute inset-0 cursor-pointer opacity-0",
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          "select-none font-display text-sm font-bold capitalize text-foreground",
          defaultClassNames.caption_label,
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex gap-1", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 select-none rounded-md text-[0.75rem] font-semibold text-muted-foreground",
          defaultClassNames.weekday,
        ),
        week: cn("mt-2 flex w-full gap-1", defaultClassNames.week),
        day: cn(
          "group/day relative flex aspect-square h-full w-full items-center justify-center p-0 text-center text-sm tabular-nums [&:first-child[data-selected]_button]:rounded-md [&:last-child[data-selected]_button]:rounded-md",
          defaultClassNames.day,
        ),
        day_button: cn(
          "inline-flex size-[--cell-size] items-center justify-center rounded-md p-0 font-normal hover:bg-accent hover:text-accent-foreground",
          defaultClassNames.day_button,
        ),
        selected: cn(
          "rounded-md [&_button]:bg-primary [&_button]:font-semibold [&_button]:text-primary-foreground [&_button]:hover:bg-primary [&_button]:hover:text-primary-foreground",
          defaultClassNames.selected,
        ),
        today: cn(
          // Bugün: yeşil halka (DESIGN.md §19.2)
          "rounded-md font-semibold [&_button]:shadow-[inset_0_0_0_1.5px_var(--bz-accent)] data-[selected=true]:text-primary-foreground",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground/70 aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "text-muted-foreground opacity-40",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chClassName, orientation, ...chevronProps }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeftIcon
              : orientation === "right"
                ? ChevronRightIcon
                : ChevronDownIcon;
          return (
            <Icon className={cn("size-4", chClassName)} {...chevronProps} />
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
