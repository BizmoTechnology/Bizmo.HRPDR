"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowRightLeft, ChevronsDownUp, ChevronsUpDown, CornerDownRight, ExternalLink, GripVertical, Network, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@ph/ui";
import { apiErrorMessage } from "@/lib/api";
import { useSetManager, type OrgChartPerson } from "@/hooks/use-reviews";
import { Dialog } from "./Dialog";
import { initials, personName } from "./shared";

const ROOT_DROP = "__root__";

interface Node {
  person: OrgChartPerson;
  children: Node[];
  depth: number;
}

function buildTree(people: OrgChartPerson[]) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const kids = new Map<string | null, OrgChartPerson[]>();
  for (const p of people) {
    const parent = p.managerId && byId.has(p.managerId) ? p.managerId : null;
    const list = kids.get(parent) ?? [];
    list.push(p);
    kids.set(parent, list);
  }
  const seen = new Set<string>();
  const make = (p: OrgChartPerson, depth: number): Node => {
    seen.add(p.id);
    return {
      person: p,
      depth,
      children: (kids.get(p.id) ?? []).filter((c) => !seen.has(c.id)).map((c) => make(c, depth + 1)),
    };
  };
  return { roots: (kids.get(null) ?? []).map((p) => make(p, 1)), byId, kids };
}

/** Kişinin tüm alt ağacı (kendisi dahil): yeni yönetici bunların arasından seçilemez */
function subtreeIds(id: string, kids: Map<string | null, OrgChartPerson[]>): Set<string> {
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of kids.get(cur) ?? []) {
      if (!out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

export function OrgChartTree({ people, canEdit }: { people: OrgChartPerson[]; canEdit: boolean }) {
  const { roots, byId, kids } = useMemo(() => buildTree(people), [people]);
  const setManager = useSetManager();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(people.map((p) => p.id)));
  const [selected, setSelected] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const blocked = useMemo(() => (dragId ? subtreeIds(dragId, kids) : new Set<string>()), [dragId, kids]);

  const q = query.trim().toLocaleLowerCase("tr");
  const matches = useCallback(
    (p: OrgChartPerson) =>
      !q || `${p.firstName} ${p.lastName} ${p.position} ${p.department?.name ?? ""}`.toLocaleLowerCase("tr").includes(q),
    [q],
  );
  /** Arama varken: eşleşen ya da eşleşen bir altı olan düğümler görünür */
  const visibleByQuery = useMemo(() => {
    if (!q) return null;
    const keep = new Set<string>();
    const walk = (n: Node): boolean => {
      const childHit = n.children.map(walk).some(Boolean);
      const hit = matches(n.person) || childHit;
      if (hit) keep.add(n.person.id);
      return hit;
    };
    roots.forEach(walk);
    return keep;
  }, [q, roots, matches]);

  // Görünür sıra (klavye gezinmesi için)
  const flat = useMemo(() => {
    const out: Node[] = [];
    const walk = (n: Node) => {
      if (visibleByQuery && !visibleByQuery.has(n.person.id)) return;
      out.push(n);
      if (expanded.has(n.person.id) || visibleByQuery) n.children.forEach(walk);
    };
    roots.forEach(walk);
    return out;
  }, [roots, expanded, visibleByQuery]);

  const currentFocus = focusId && flat.some((n) => n.person.id === focusId) ? focusId : flat[0]?.person.id ?? null;

  useEffect(() => {
    if (focusId) rowRefs.current.get(focusId)?.focus();
  }, [focusId]);

  async function move(personId: string, managerId: string | null) {
    const person = byId.get(personId);
    if (!person) return;
    const previous = person.managerId;
    if (previous === managerId) return;
    try {
      await setManager.mutateAsync({ personnelId: personId, managerId });
      if (managerId) setExpanded((s) => new Set(s).add(managerId));
      const target = managerId ? byId.get(managerId) : null;
      toast.success(
        target
          ? `${personName(person)}, ${personName(target)} altına taşındı`
          : `${personName(person)} en üst düzeye taşındı`,
        {
          action: {
            label: "Geri al",
            onClick: () => {
              setManager.mutate(
                { personnelId: personId, managerId: previous },
                { onError: (err) => toast.error(apiErrorMessage(err, "Geri alınamadı")) },
              );
            },
          },
        },
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "Yönetici değiştirilemedi"));
    }
  }

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id).replace("node:", ""));
  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id).replace("node:", "");
    setDragId(null);
    if (!e.over) return;
    const overId = String(e.over.id).replace("target:", "");
    const managerId = overId === ROOT_DROP ? null : overId;
    if (managerId && subtreeIds(id, kids).has(managerId)) {
      toast.error("Kişi kendi altındaki birine bağlanamaz");
      return;
    }
    void move(id, managerId);
  };

  function onTreeKey(e: KeyboardEvent<HTMLUListElement>) {
    const idx = flat.findIndex((n) => n.person.id === currentFocus);
    if (idx < 0) return;
    const node = flat[idx]!;
    const id = node.person.id;
    const go = (i: number) => {
      const n = flat[Math.max(0, Math.min(flat.length - 1, i))];
      if (n) setFocusId(n.person.id);
    };
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        go(idx + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        go(idx - 1);
        break;
      case "Home":
        e.preventDefault();
        go(0);
        break;
      case "End":
        e.preventDefault();
        go(flat.length - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (node.children.length === 0) break;
        if (!expanded.has(id)) setExpanded((s) => new Set(s).add(id));
        else go(idx + 1);
        break;
      case "ArrowLeft": {
        e.preventDefault();
        if (expanded.has(id) && node.children.length > 0) {
          setExpanded((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        } else if (node.person.managerId) {
          setFocusId(node.person.managerId);
        }
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        setSelected(id);
        break;
    }
  }

  const sel = selected ? byId.get(selected) : null;
  const selManager = sel?.managerId ? byId.get(sel.managerId) : null;
  const selReports = sel ? kids.get(sel.id) ?? [] : [];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragId(null)}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bz-card min-w-0 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="bz-input-group w-full sm:w-auto sm:min-w-0 sm:max-w-xs sm:flex-1">
              <span className="bz-input-prefix">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Kişi ara"
                aria-label="Org şemasında ara"
                className="bz-field bz-field--sm"
              />
            </div>
            <button type="button" className="bz-btn bz-btn--ghost bz-btn--sm" onClick={() => setExpanded(new Set(people.map((p) => p.id)))}>
              <ChevronsUpDown />
              Tümünü aç
            </button>
            <button type="button" className="bz-btn bz-btn--ghost bz-btn--sm" onClick={() => setExpanded(new Set())}>
              <ChevronsDownUp />
              Tümünü kapat
            </button>
          </div>

          {canEdit && <RootDrop active={!!dragId} />}

          {flat.length === 0 ? (
            <p className="py-8 text-center text-sm text-fg3">Eşleşen kişi yok</p>
          ) : (
            <ul className="bz-tree" role="tree" aria-label="Org şeması" onKeyDown={onTreeKey}>
              {roots.map((n) => (
                <TreeNode
                  key={n.person.id}
                  node={n}
                  expanded={expanded}
                  forceOpen={!!visibleByQuery}
                  visible={visibleByQuery}
                  selected={selected}
                  focusId={currentFocus}
                  blocked={blocked}
                  canEdit={canEdit}
                  highlight={q ? matches : null}
                  registerRow={(id, el) => {
                    if (el) rowRefs.current.set(id, el);
                    else rowRefs.current.delete(id);
                  }}
                  onToggle={(id) =>
                    setExpanded((s) => {
                      const next = new Set(s);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onSelect={(id) => {
                    setSelected(id);
                    setFocusId(id);
                  }}
                />
              ))}
            </ul>
          )}
          <p className="bz-hint mt-3">
            Kişiyi bir yöneticinin üzerine sürükleyip bırakın. Klavyede ↑↓ ile gezinin, → / ← ile açıp kapatın,
            Enter ile seçip yan paneldeki “Taşı…” düğmesini kullanın.
          </p>
        </div>

        <aside className="bz-card h-fit p-4 lg:sticky lg:top-20" aria-live="polite">
          {!sel ? (
            <div className="bz-empty px-2 py-6">
              <span className="bz-icon-box">
                <Network />
              </span>
              <p className="bz-empty__title">Kişi seçin</p>
              <p className="bz-empty__text">Ağaçtan bir kişi seçince yöneticisi ve astları burada görünür.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="bz-avatar bz-avatar--round" aria-hidden="true">
                  {initials(sel)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-foreground">{personName(sel)}</p>
                  <p className="truncate text-xs text-fg3">
                    {sel.position}
                    {sel.department ? ` · ${sel.department.name}` : ""}
                  </p>
                </div>
              </div>
              <dl className="space-y-2 text-[13px]">
                <div>
                  <dt className="text-xs font-semibold text-fg3">Yönetici</dt>
                  <dd className="text-foreground">{selManager ? personName(selManager) : "Yok (en üst düzey)"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-fg3">Doğrudan astlar</dt>
                  <dd className="text-foreground">
                    {selReports.length === 0 ? "Yok" : selReports.map(personName).join(", ")}
                  </dd>
                </div>
                {sel.team && (
                  <div>
                    <dt className="text-xs font-semibold text-fg3">Ekip</dt>
                    <dd className="text-foreground">{sel.team.name}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <button type="button" className="bz-btn bz-btn--soft bz-btn--sm" onClick={() => setMoveId(sel.id)}>
                    <ArrowRightLeft />
                    Taşı…
                  </button>
                )}
                <Link href={`/personnel/${sel.id}`} className="bz-btn bz-btn--ghost bz-btn--sm">
                  <ExternalLink />
                  Personel kaydı
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragId && byId.get(dragId) ? (
          <div className="bz-kanban-card is-dragging !py-2">
            <span className="text-[13px] font-semibold">{personName(byId.get(dragId)!)}</span>
          </div>
        ) : null}
      </DragOverlay>

      <ManagerDialog
        personId={moveId}
        people={people}
        kids={kids}
        onClose={() => setMoveId(null)}
        onPick={(managerId) => {
          const id = moveId;
          setMoveId(null);
          if (id) void move(id, managerId);
        }}
      />
    </DndContext>
  );
}

function RootDrop({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `target:${ROOT_DROP}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mb-2 rounded-xl border-[1.5px] border-dashed px-3 text-center text-xs font-semibold transition-all",
        active ? "border-divider py-3 text-fg2" : "border-transparent py-0 text-transparent",
        isOver && "border-brand bg-brand-soft text-foreground",
      )}
      aria-hidden={!active}
    >
      En üst düzey (yöneticisiz): buraya bırakın
    </div>
  );
}

function TreeNode({
  node,
  expanded,
  forceOpen,
  visible,
  selected,
  focusId,
  blocked,
  canEdit,
  highlight,
  registerRow,
  onToggle,
  onSelect,
}: {
  node: Node;
  expanded: Set<string>;
  forceOpen: boolean;
  visible: Set<string> | null;
  selected: string | null;
  focusId: string | null;
  blocked: Set<string>;
  canEdit: boolean;
  highlight: ((p: OrgChartPerson) => boolean) | null;
  registerRow: (id: string, el: HTMLDivElement | null) => void;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const { person, children } = node;
  const id = person.id;
  const drag = useDraggable({ id: `node:${id}`, disabled: !canEdit });
  const drop = useDroppable({ id: `target:${id}`, disabled: !canEdit || blocked.has(id) });
  if (visible && !visible.has(id)) return null;

  const open = forceOpen || expanded.has(id);
  const hasKids = children.length > 0;
  const setRow = (el: HTMLDivElement | null) => {
    drag.setNodeRef(el);
    drop.setNodeRef(el);
    registerRow(id, el);
  };

  return (
    <li
      role="treeitem"
      aria-expanded={hasKids ? open : undefined}
      aria-selected={selected === id}
      aria-level={node.depth}
      aria-label={`${personName(person)}, ${person.position}${hasKids ? `, ${children.length} ast` : ""}`}
    >
      <div
        ref={setRow}
        tabIndex={focusId === id ? 0 : -1}
        {...drag.listeners}
        onClick={() => onSelect(id)}
        className={cn(
          "bz-tree-item min-w-0 !h-auto min-h-[40px] py-1",
          canEdit && "touch-manipulation",
          drag.isDragging && "opacity-40",
          drop.isOver && "ring-2 ring-brand",
          blocked.has(id) && blocked.size > 0 && !drag.isDragging && "opacity-60",
        )}
        aria-selected={selected === id}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation();
            if (hasKids) onToggle(id);
          }}
          className={cn("bz-tree-item__caret border-0 bg-transparent p-0", !hasKids && "bz-tree-item__caret--leaf")}
        />
        {canEdit && <GripVertical className="!h-3.5 !w-3.5 cursor-grab" aria-hidden="true" />}
        <span className="bz-avatar bz-avatar--sm bz-avatar--round shrink-0" aria-hidden="true">
          {initials(person)}
        </span>
        <span className="bz-tree-item__label min-w-0">
          <span
            className={cn(
              "block truncate font-semibold",
              highlight && highlight(person) && "rounded bg-warning-soft px-1",
            )}
          >
            {personName(person)}
          </span>
          <span className="block truncate text-[11.5px] text-fg3">
            {person.position}
            {person.department ? ` · ${person.department.name}` : ""}
            {person.status !== "ACTIVE" ? ` · ${person.status === "ON_LEAVE" ? "İzinde" : "Pasif"}` : ""}
          </span>
        </span>
        {hasKids && (
          <span className="bz-tree-item__count" aria-hidden="true">
            {children.length}
          </span>
        )}
      </div>
      {hasKids && open && (
        <ul role="group">
          {children.map((c) => (
            <TreeNode
              key={c.person.id}
              node={c}
              expanded={expanded}
              forceOpen={forceOpen}
              visible={visible}
              selected={selected}
              focusId={focusId}
              blocked={blocked}
              canEdit={canEdit}
              highlight={highlight}
              registerRow={registerRow}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function ManagerDialog({
  personId,
  people,
  kids,
  onClose,
  onPick,
}: {
  personId: string | null;
  people: OrgChartPerson[];
  kids: Map<string | null, OrgChartPerson[]>;
  onClose: () => void;
  onPick: (managerId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const person = personId ? people.find((p) => p.id === personId) : null;
  const [choice, setChoice] = useState<string>("");
  const [lastId, setLastId] = useState<string | null>(null);
  if (personId !== lastId) {
    setLastId(personId);
    setQuery("");
    setChoice(person?.managerId ?? ROOT_DROP);
  }

  const excluded = useMemo(() => (personId ? subtreeIds(personId, kids) : new Set<string>()), [personId, kids]);
  const q = query.trim().toLocaleLowerCase("tr");
  const options = people.filter(
    (p) =>
      !excluded.has(p.id) &&
      (!q || `${p.firstName} ${p.lastName} ${p.position}`.toLocaleLowerCase("tr").includes(q)),
  );

  return (
    <Dialog
      open={!!person}
      onClose={onClose}
      title={person ? `${personName(person)}: yeni yönetici` : "Yönetici seç"}
      description="Kişinin kendisi ve altındakiler listede yer almaz."
      footer={
        <>
          <button type="button" className="bz-btn" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="button"
            className="bz-btn bz-btn--primary"
            onClick={() => onPick(choice === ROOT_DROP ? null : choice)}
            disabled={!choice || choice === (person?.managerId ?? ROOT_DROP)}
          >
            Taşı
          </button>
        </>
      }
    >
      <div className="bz-input-group mb-2">
        <span className="bz-input-prefix">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Yönetici ara"
          aria-label="Yönetici ara"
          className="bz-field bz-field--sm"
          data-autofocus
        />
      </div>
      <fieldset>
        <legend className="sr-only">Yeni yönetici</legend>
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          <li>
            <label className="bz-choice-card">
              <input
                type="radio"
                name="new-manager"
                checked={choice === ROOT_DROP}
                onChange={() => setChoice(ROOT_DROP)}
              />
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <CornerDownRight className="h-4 w-4 text-fg3" aria-hidden="true" />
                En üst düzey (yöneticisiz)
              </span>
            </label>
          </li>
          {options.map((p) => (
            <li key={p.id}>
              <label className="bz-choice-card">
                <input type="radio" name="new-manager" checked={choice === p.id} onChange={() => setChoice(p.id)} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{personName(p)}</span>
                  <span className="block truncate text-xs text-fg3">
                    {p.position}
                    {p.department ? ` · ${p.department.name}` : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </Dialog>
  );
}
