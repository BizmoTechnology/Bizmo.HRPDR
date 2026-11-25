"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AlertTriangle, ArrowRightLeft, GripVertical, Lock, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@ph/ui";
import {
  RELATION_LABEL,
  type ReviewAssignmentStatus,
  type ReviewRelation,
  type SubjectPlan,
} from "@/hooks/use-reviews";
import { Dialog } from "./Dialog";
import { AssignmentStatusBadge, initials, personName } from "./shared";

export interface BoardPerson {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  department: { id: string; name: string } | null;
  team?: { id: string; name: string } | null;
}

/** Sürüklenebilen gruplar (öz değerlendirme kartta açma/kapama ile yönetilir) */
const COLUMNS: Array<Exclude<ReviewRelation, "SELF">> = ["MANAGER", "PEER", "SUBORDINATE"];
const ANONYMOUS: ReviewRelation[] = ["PEER", "SUBORDINATE"];

type DragData =
  | { kind: "pool"; personId: string }
  | { kind: "chip"; subjectId: string; personId: string; relation: ReviewRelation };
type DropData = { subjectId: string; relation: ReviewRelation };

/** Önce imlecin altındaki hedef; klavye ile sürüklemede (imleç yok) kesişen hedef */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

export interface RaterBoardProps {
  people: BoardPerson[];
  plan: SubjectPlan[];
  onChange: (plan: SubjectPlan[]) => void;
  anonymityMinRaters: number;
  /** Başlamış dönemde atamanın durumu (tamamlanan kilitlenir) */
  statusOf?: (subjectId: string, raterId: string) => ReviewAssignmentStatus | undefined;
  onRemoveSubject?: (subjectId: string) => void;
  disabled?: boolean;
}

export function RaterBoard({
  people,
  plan,
  onChange,
  anonymityMinRaters,
  statusOf,
  onRemoveSubject,
  disabled,
}: RaterBoardProps) {
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [moveTarget, setMoveTarget] = useState<DragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const isLocked = (subjectId: string, raterId: string) => statusOf?.(subjectId, raterId) === "COMPLETED";

  const pool = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return people.filter((p) =>
      !q
        ? true
        : `${p.firstName} ${p.lastName} ${p.position} ${p.department?.name ?? ""}`
            .toLocaleLowerCase("tr")
            .includes(q),
    );
  }, [people, query]);

  /** Kişiyi değerlendirilenin bir grubuna yerleştirir; zaten varsa grubunu değiştirir */
  function place(personId: string, subjectId: string, relation: ReviewRelation, from?: string) {
    const person = byId.get(personId);
    if (!person) return;
    if (relation !== "SELF" && personId === subjectId) {
      toast.error("Kişi kendisini yönetici, eş düzey ya da ast olarak değerlendiremez");
      return;
    }
    if (from && from !== subjectId && isLocked(from, personId)) {
      toast.error("Tamamlanmış değerlendirme taşınamaz");
      return;
    }
    const current = plan.find((s) => s.personnelId === subjectId)?.raters.find((r) => r.personnelId === personId);
    if (current && current.relation !== relation && isLocked(subjectId, personId)) {
      toast.error("Tamamlanmış değerlendirmenin grubu değiştirilemez");
      return;
    }
    const next = plan.map((s) => {
      if (s.personnelId === from && from !== subjectId) {
        return { ...s, raters: s.raters.filter((r) => r.personnelId !== personId) };
      }
      if (s.personnelId !== subjectId) return s;
      const others = s.raters.filter((r) => r.personnelId !== personId);
      return { ...s, raters: [...others, { personnelId: personId, relation }] };
    });
    onChange(next);
    toast.success(
      `${personName(person)} → ${personName(byId.get(subjectId) ?? person)} · ${RELATION_LABEL[relation]}`,
      { duration: 1800 },
    );
  }

  function remove(subjectId: string, personId: string) {
    if (isLocked(subjectId, personId)) {
      toast.error("Tamamlanmış değerlendirme kaldırılamaz");
      return;
    }
    onChange(
      plan.map((s) =>
        s.personnelId === subjectId ? { ...s, raters: s.raters.filter((r) => r.personnelId !== personId) } : s,
      ),
    );
  }

  function toggleSelf(subjectId: string, on: boolean) {
    if (!on && isLocked(subjectId, subjectId)) {
      toast.error("Tamamlanmış öz değerlendirme kaldırılamaz");
      return;
    }
    onChange(
      plan.map((s) => {
        if (s.personnelId !== subjectId) return s;
        const rest = s.raters.filter((r) => r.relation !== "SELF");
        return { ...s, raters: on ? [{ personnelId: subjectId, relation: "SELF" }, ...rest] : rest };
      }),
    );
  }

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current as DragData) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const a = e.active.data.current as DragData | undefined;
    const o = e.over?.data.current as DropData | undefined;
    if (!a || !o) return;
    if (a.kind === "chip" && a.subjectId === o.subjectId && a.relation === o.relation) return;
    place(a.personId, o.subjectId, o.relation, a.kind === "chip" ? a.subjectId : undefined);
  };

  const label = (id: string) => {
    const p = byId.get(id);
    return p ? personName(p) : "kişi";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${label((active.data.current as DragData).personId)} tutuldu. Ok tuşlarıyla taşıyın, Boşluk ile bırakın, Esc ile vazgeçin.`,
    onDragOver: ({ over }) => {
      const o = over?.data.current as DropData | undefined;
      return o ? `${label(o.subjectId)} kartında ${RELATION_LABEL[o.relation]} grubunun üzerinde.` : "Bırakma alanı dışında.";
    },
    onDragEnd: ({ active, over }) => {
      const o = over?.data.current as DropData | undefined;
      return o
        ? `${label((active.data.current as DragData).personId)}, ${label(o.subjectId)} için ${RELATION_LABEL[o.relation]} grubuna bırakıldı.`
        : "Bırakılmadı.";
    },
    onDragCancel: () => "Taşıma iptal edildi.",
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Taşımak için Boşluk tuşuna basın. Sürükleme yerine her kişideki Taşı düğmesini de kullanabilirsiniz.",
        },
      }}
    >
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Aday havuzu */}
        <aside className="bz-card flex min-w-0 flex-col p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)]" aria-label="Personel havuzu">
          <p className="px-1 text-[13px] font-bold text-foreground">Personel</p>
          <p className="mb-2 px-1 text-xs text-fg3">Kişiyi bir karttaki gruba sürükleyin ya da “Taşı” ile seçin.</p>
          <div className="bz-input-group mb-2">
            <span className="bz-input-prefix">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ad, pozisyon, departman"
              aria-label="Personel ara"
              className="bz-field bz-field--sm"
            />
          </div>
          <ul className="bz-scroll -mx-1 max-h-72 space-y-1 overflow-y-auto px-1 lg:max-h-none lg:flex-1">
            {pool.map((p) => (
              <li key={p.id}>
                <PoolItem person={p} disabled={disabled} onMove={() => setMoveTarget({ kind: "pool", personId: p.id })} />
              </li>
            ))}
            {pool.length === 0 && <li className="px-2 py-6 text-center text-sm text-fg3">Eşleşen personel yok</li>}
          </ul>
        </aside>

        {/* Değerlendirilen kartları */}
        <div className="grid min-w-0 content-start gap-3 2xl:grid-cols-2">
          {plan.length === 0 && (
            <div className="bz-card 2xl:col-span-2">
              <div className="bz-empty">
                <span className="bz-icon-box">
                  <UserRound />
                </span>
                <p className="bz-empty__title">Değerlendirilen seçilmedi</p>
                <p className="bz-empty__text">Önce değerlendirilecek kişileri ekleyin; değerlendiriciler org şemasından önerilir.</p>
              </div>
            </div>
          )}
          {plan.map((s) => {
            const subject = byId.get(s.personnelId);
            if (!subject) return null;
            const selfOn = s.raters.some((r) => r.relation === "SELF");
            return (
              <section key={s.personnelId} className="bz-card min-w-0 p-3" aria-label={`${personName(subject)} değerlendiricileri`}>
                <header className="mb-2 flex items-start gap-2.5">
                  <span className="bz-avatar bz-avatar--sm bz-avatar--round" aria-hidden="true">
                    {initials(subject)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-foreground">{personName(subject)}</p>
                    <p className="truncate text-xs text-fg3">
                      {subject.position}
                      {subject.department ? ` · ${subject.department.name}` : ""}
                    </p>
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-fg2">
                    <span className="bz-switch bz-switch--sm">
                      <input
                        type="checkbox"
                        checked={selfOn}
                        disabled={disabled}
                        onChange={(e) => toggleSelf(s.personnelId, e.target.checked)}
                        aria-label={`${personName(subject)} öz değerlendirme`}
                      />
                    </span>
                    Öz
                  </label>
                  {onRemoveSubject && (
                    <button
                      type="button"
                      className="bz-icon-btn bz-icon-btn--sm"
                      onClick={() => onRemoveSubject(s.personnelId)}
                      disabled={disabled}
                      aria-label={`${personName(subject)} kişisini dönemden çıkar`}
                      title="Dönemden çıkar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </header>
                <div className="grid gap-2 sm:grid-cols-3">
                  {COLUMNS.map((rel) => {
                    const raters = s.raters.filter((r) => r.relation === rel);
                    const below = ANONYMOUS.includes(rel) && raters.length > 0 && raters.length < anonymityMinRaters;
                    return (
                      <DropColumn
                        key={rel}
                        subjectId={s.personnelId}
                        relation={rel}
                        count={raters.length}
                        warning={
                          below
                            ? `${raters.length} / ${anonymityMinRaters}: eşik altında, sonuç gizlenir`
                            : undefined
                        }
                        disabled={disabled}
                      >
                        {raters.map((r) => {
                          const p = byId.get(r.personnelId);
                          if (!p) return null;
                          return (
                            <RaterChip
                              key={r.personnelId}
                              subjectId={s.personnelId}
                              person={p}
                              relation={rel}
                              status={statusOf?.(s.personnelId, r.personnelId)}
                              locked={isLocked(s.personnelId, r.personnelId)}
                              disabled={disabled}
                              onRemove={() => remove(s.personnelId, r.personnelId)}
                              onMove={() =>
                                setMoveTarget({ kind: "chip", subjectId: s.personnelId, personId: r.personnelId, relation: rel })
                              }
                            />
                          );
                        })}
                      </DropColumn>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="bz-kanban-card is-dragging !py-2">
            <span className="text-[13px] font-semibold">{label(dragging.personId)}</span>
          </div>
        ) : null}
      </DragOverlay>

      <MoveDialog
        target={moveTarget}
        onClose={() => setMoveTarget(null)}
        plan={plan}
        byId={byId}
        onPlace={(subjectId, relation) => {
          if (!moveTarget) return;
          place(moveTarget.personId, subjectId, relation, moveTarget.kind === "chip" ? moveTarget.subjectId : undefined);
          setMoveTarget(null);
        }}
      />
    </DndContext>
  );
}

function PoolItem({ person, onMove, disabled }: { person: BoardPerson; onMove: () => void; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${person.id}`,
    data: { kind: "pool", personId: person.id } satisfies DragData,
    disabled,
  });
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-xl border border-transparent px-1 py-1 hover:border-divider hover:bg-hover",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        aria-label={`${personName(person)}: sürükle`}
        className="flex min-h-[40px] min-w-0 flex-1 cursor-grab touch-manipulation items-center gap-2 rounded-lg px-1 text-left active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 shrink-0 text-fg3" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-foreground">{personName(person)}</span>
          <span className="block truncate text-[11.5px] text-fg3">
            {person.position}
            {person.department ? ` · ${person.department.name}` : ""}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onMove}
        disabled={disabled}
        className="bz-btn bz-btn--ghost bz-btn--sm shrink-0"
        aria-label={`${personName(person)} kişisini taşı`}
      >
        <ArrowRightLeft />
        Taşı…
      </button>
    </div>
  );
}

function DropColumn({
  subjectId,
  relation,
  count,
  warning,
  children,
  disabled,
}: {
  subjectId: string;
  relation: ReviewRelation;
  count: number;
  warning?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${subjectId}:${relation}`,
    data: { subjectId, relation } satisfies DropData,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bz-well flex min-h-[88px] min-w-0 flex-col gap-1.5 rounded-xl p-2 transition-shadow",
        isOver && "ring-2 ring-brand",
      )}
      data-drop={isOver || undefined}
    >
      <p className="flex items-center justify-between text-[11.5px] font-bold uppercase tracking-wide text-fg3">
        {RELATION_LABEL[relation]}
        <span className="tabular-nums">{count}</span>
      </p>
      {children}
      {count === 0 && <p className="py-2 text-center text-[11.5px] text-fg3">Buraya bırakın</p>}
      {warning && (
        <p className="flex items-start gap-1 text-[11.5px] font-semibold text-warning-ink">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      )}
    </div>
  );
}

function RaterChip({
  subjectId,
  person,
  relation,
  status,
  locked,
  disabled,
  onRemove,
  onMove,
}: {
  subjectId: string;
  person: BoardPerson;
  relation: ReviewRelation;
  status?: ReviewAssignmentStatus;
  locked: boolean;
  disabled?: boolean;
  onRemove: () => void;
  onMove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip:${subjectId}:${person.id}`,
    data: { kind: "chip", subjectId, personId: person.id, relation } satisfies DragData,
    disabled: disabled || locked,
  });
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border border-divider bg-surface px-1.5 py-1.5 shadow-1",
        isDragging && "opacity-40",
      )}
    >
      <button
        type="button"
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        disabled={disabled || locked}
        aria-label={`${personName(person)}, ${RELATION_LABEL[relation]}${locked ? ", tamamlandı, kilitli" : ": sürükle"}`}
        className={cn(
          "flex min-h-[28px] w-full min-w-0 items-center gap-1.5 rounded-md text-left disabled:opacity-100",
          locked ? "cursor-default" : "cursor-grab touch-manipulation active:cursor-grabbing",
        )}
      >
        {locked ? (
          <Lock className="h-3.5 w-3.5 shrink-0 text-fg3" aria-hidden="true" />
        ) : (
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-fg3" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground" title={personName(person)}>
          {personName(person)}
        </span>
      </button>
      {((status && status !== "NOT_STARTED") || !locked) && (
        <div className="flex min-w-0 flex-wrap items-center gap-1 pl-5">
          {status && status !== "NOT_STARTED" && <AssignmentStatusBadge status={status} />}
          {!locked && (
            <span className="ml-auto flex items-center">
              <button
                type="button"
                onClick={onMove}
                disabled={disabled}
                className="bz-icon-btn bz-icon-btn--sm"
                aria-label={`${personName(person)} kişisini taşı`}
                title="Taşı…"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="bz-icon-btn bz-icon-btn--sm"
                aria-label={`${personName(person)} kişisini kaldır`}
                title="Kaldır"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Sürükle-bırakın klavye karşılığı (DESIGN.md §20, §45): değerlendirilen ve grup seçilir */
function MoveDialog({
  target,
  onClose,
  plan,
  byId,
  onPlace,
}: {
  target: DragData | null;
  onClose: () => void;
  plan: SubjectPlan[];
  byId: Map<string, BoardPerson>;
  onPlace: (subjectId: string, relation: ReviewRelation) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [relation, setRelation] = useState<ReviewRelation>("PEER");
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Hedef değişince seçimleri kişiye göre başlat
  const key = target ? `${target.kind}:${target.personId}:${target.kind === "chip" ? target.subjectId : ""}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (target) {
      const firstOther = plan.find((s) => s.personnelId !== target.personId)?.personnelId ?? plan[0]?.personnelId ?? "";
      setSubjectId(target.kind === "chip" ? target.subjectId : firstOther);
      setRelation(target.kind === "chip" ? (target.relation === "SELF" ? "PEER" : target.relation) : "PEER");
    }
  }

  const person = target ? byId.get(target.personId) : undefined;
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title={person ? `${personName(person)} kişisini taşı` : "Taşı"}
      description="Değerlendirileni ve değerlendirici grubunu seçin."
      footer={
        <>
          <button type="button" className="bz-btn" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="button"
            className="bz-btn bz-btn--primary"
            disabled={!subjectId}
            onClick={() => onPlace(subjectId, relation)}
          >
            Taşı
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bz-form-row">
          <label className="bz-label" htmlFor="move-subject">
            Değerlendirilen
          </label>
          <select
            id="move-subject"
            className="bz-field"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            {plan.map((s) => {
              const p = byId.get(s.personnelId);
              return p ? (
                <option key={s.personnelId} value={s.personnelId}>
                  {personName(p)}
                </option>
              ) : null;
            })}
          </select>
        </div>
        <fieldset>
          <legend className="bz-label mb-2">Grup</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {COLUMNS.map((rel) => (
              <label key={rel} className="bz-choice-card">
                <input
                  type="radio"
                  name="move-relation"
                  value={rel}
                  checked={relation === rel}
                  onChange={() => setRelation(rel)}
                />
                <span className="text-[13px] font-semibold">{RELATION_LABEL[rel]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {target && subjectId === target.personId && (
          <p className="bz-hint text-warning-ink">Kişi kendisini değerlendiremez; başka bir değerlendirilen seçin.</p>
        )}
      </div>
    </Dialog>
  );
}
