"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CornerDownLeft, Search } from "lucide-react";
import { useVisibleNavSections, type NavItem } from "./nav";

type PaletteItem = NavItem & { group: string };

/** Komut paleti (DESIGN.md §15): ⌘K / Ctrl+K, ↑↓ gezinme, Enter git, Esc kapat */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sections = useVisibleNavSections();
  const allItems = useMemo<PaletteItem[]>(
    () => sections.flatMap((section) => section.items.map((item) => ({ ...item, group: section.title }))),
    [sections],
  );

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return allItems;
    return allItems.filter((item) =>
      [item.label, item.href, item.group, ...(item.keywords ?? [])]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(q),
    );
  }, [query, allItems]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const go = (item: PaletteItem) => {
    router.push(item.href);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter" && results[index]) {
      e.preventDefault();
      go(results[index]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <>
      <motion.div
        className="bz-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-x-0 top-[max(4rem,14vh)] z-modal flex justify-center px-3">
        <motion.div
          className="bz-command bz-glass-strong pointer-events-auto"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
          role="dialog"
          aria-modal="true"
          aria-label="Hızlı gezinme"
        >
          <div className="bz-command__input">
            <Search className="h-5 w-5 flex-none text-fg3" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Sayfa veya özellik arayın"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-results"
              aria-activedescendant={results[index] ? `command-item-${index}` : undefined}
            />
            <kbd className="bz-kbd">Esc</kbd>
          </div>
          <div ref={listRef} id="command-results" role="listbox" className="max-h-[min(380px,55vh)] overflow-y-auto pb-2">
            {results.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                “{query}” için sonuç yok. Başka bir sözcük deneyin.
              </p>
            ) : (
              results.map((item, i) => {
                const Icon = item.icon;
                const showGroup = i === 0 || results[i - 1]!.group !== item.group;
                const selected = i === index;
                return (
                  <Fragment key={item.href}>
                    {showGroup ? <div className="bz-command__group">{item.group}</div> : null}
                    <div
                      id={`command-item-${i}`}
                      role="option"
                      aria-selected={selected}
                      className="bz-command__item cursor-pointer"
                      onClick={() => go(item)}
                      onMouseMove={() => setIndex(i)}
                    >
                      <span className="bz-icon-box" aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {selected ? <CornerDownLeft className="h-4 w-4 text-fg3" aria-hidden="true" /> : null}
                    </div>
                  </Fragment>
                );
              })
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-divider px-5 py-2.5 text-xs text-muted-foreground">
            <span>
              <kbd className="bz-kbd">↑</kbd> <kbd className="bz-kbd">↓</kbd> seç
            </span>
            <span>
              <kbd className="bz-kbd">Enter</kbd> git
            </span>
            <span>
              <kbd className="bz-kbd">Esc</kbd> kapat
            </span>
          </div>
        </motion.div>
      </div>
    </>
  );
}
