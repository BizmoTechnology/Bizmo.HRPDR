"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { cn } from "@ph/ui";
import { Dialog } from "./Dialog";
import type { BoardPerson } from "./RaterBoard";
import { personName } from "./shared";

/** Değerlendirilecek kişileri seçme penceresi (departman süzgeci + toplu seçim) */
export function SubjectPicker({
  people,
  existing,
  onAdd,
  disabled,
}: {
  people: BoardPerson[];
  existing: Set<string>;
  onAdd: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const departments = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) if (p.department) m.set(p.department.id, p.department.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));
  }, [people]);

  const q = query.trim().toLocaleLowerCase("tr");
  const visible = people.filter(
    (p) =>
      !existing.has(p.id) &&
      (dept === "all" || p.department?.id === dept) &&
      (!q || `${p.firstName} ${p.lastName} ${p.position}`.toLocaleLowerCase("tr").includes(q)),
  );
  const allPicked = visible.length > 0 && visible.every((p) => picked.has(p.id));

  const close = () => {
    setOpen(false);
    setPicked(new Set());
    setQuery("");
  };

  return (
    <>
      <button type="button" className="bz-btn bz-btn--soft" onClick={() => setOpen(true)} disabled={disabled}>
        <UserPlus />
        Değerlendirilen ekle
      </button>
      <Dialog
        open={open}
        onClose={close}
        title="Değerlendirilen ekle"
        description="Seçtiğiniz kişiler için yönetici, eş düzey ve astlar org şemasından önerilir."
        footer={
          <>
            <button type="button" className="bz-btn" onClick={close}>
              Vazgeç
            </button>
            <button
              type="button"
              className="bz-btn bz-btn--primary"
              disabled={picked.size === 0}
              onClick={() => {
                onAdd([...picked]);
                close();
              }}
            >
              Ekle ({picked.size})
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="bz-input-group flex-1">
              <span className="bz-input-prefix">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="search"
                className="bz-field bz-field--sm"
                placeholder="Personel ara"
                aria-label="Personel ara"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="bz-field bz-field--sm sm:w-44"
              aria-label="Departman"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
            >
              <option value="all">Tüm departmanlar</option>
              {departments.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <label className="bz-check flex items-center gap-2 px-1 py-1 text-[13px] font-semibold">
            <input
              type="checkbox"
              checked={allPicked}
              disabled={visible.length === 0}
              onChange={() =>
                setPicked((s) => {
                  const n = new Set(s);
                  for (const p of visible) {
                    if (allPicked) n.delete(p.id);
                    else n.add(p.id);
                  }
                  return n;
                })
              }
            />
            Görünenlerin tümü ({visible.length})
          </label>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {visible.map((p) => {
              const on = picked.has(p.id);
              return (
                <li key={p.id}>
                  <label
                    className={cn(
                      "bz-check flex min-h-[48px] w-full rounded-xl px-3 py-2 transition-colors",
                      on ? "bg-brand-soft" : "hover:bg-hover",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setPicked((s) => {
                          const n = new Set(s);
                          if (n.has(p.id)) n.delete(p.id);
                          else n.add(p.id);
                          return n;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-foreground">{personName(p)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.position} · {p.department?.name ?? "—"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="py-6 text-center text-sm text-fg3">Eklenecek kişi yok</li>
            )}
          </ul>
        </div>
      </Dialog>
    </>
  );
}
