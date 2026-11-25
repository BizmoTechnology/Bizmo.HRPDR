"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { cn } from "@ph/ui";

interface SortableRow {
  id: string;
}

/**
 * Sürükleyerek sıralanan liste (soru seti maddeleri). Klavye: tutamağa odaklanıp
 * Boşluk ile tut, ↑↓ ile taşı, Boşluk ile bırak; ayrıca her satırda yukarı/aşağı düğmeleri var.
 */
export function SortableItemList<T extends SortableRow>({
  items,
  onReorder,
  renderItem,
  label,
  disabled,
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  label: (item: T) => string;
  disabled?: boolean;
}) {
  const [order, setOrder] = useState(items);
  useEffect(() => setOrder(items), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const commit = (next: T[]) => {
    setOrder(next);
    onReorder(next);
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = order.findIndex((i) => i.id === e.active.id);
    const to = order.findIndex((i) => i.id === e.over!.id);
    if (from < 0 || to < 0) return;
    commit(arrayMove(order, from, to));
  };

  const nameOf = (id: string | number) => {
    const it = order.find((i) => i.id === id);
    return it ? label(it) : "madde";
  };
  const posOf = (id: string | number) => order.findIndex((i) => i.id === id) + 1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Sıralamak için Boşluk tuşuna basın, ok tuşlarıyla taşıyın, Boşluk ile bırakın, Esc ile vazgeçin.",
        },
        announcements: {
          onDragStart: ({ active }) => `${nameOf(active.id)} tutuldu, sıra ${posOf(active.id)}.`,
          onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)}, sıra ${posOf(over.id)} üzerinde.` : ""),
          onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} sıra ${posOf(over.id)} konumuna bırakıldı.` : "Bırakılmadı."),
          onDragCancel: ({ active }) => `${nameOf(active.id)} taşıma iptal edildi.`,
        },
      }}
    >
      <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ol className="divide-y divide-divider">
          {order.map((item, idx) => (
            <SortableItem
              key={item.id}
              id={item.id}
              index={idx}
              total={order.length}
              name={label(item)}
              disabled={disabled}
              onMove={(delta) => {
                const to = idx + delta;
                if (to < 0 || to >= order.length) return;
                commit(arrayMove(order, idx, to));
              }}
            >
              {renderItem(item, idx)}
            </SortableItem>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({
  id,
  index,
  total,
  name,
  disabled,
  onMove,
  children,
}: {
  id: string;
  index: number;
  total: number;
  name: string;
  disabled?: boolean;
  onMove: (delta: -1 | 1) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative -mx-2 flex items-start gap-3 rounded-xl bg-[var(--bz-surface)] px-2 py-3 transition-colors hover:bg-hover",
        isDragging && "z-10 shadow-3",
      )}
    >
      <div className="flex shrink-0 items-center gap-1 pt-0.5">
        {!disabled && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            aria-label={`${name}: sırayı değiştirmek için sürükle`}
            className="grid h-7 w-6 cursor-grab touch-manipulation place-items-center rounded-md text-fg3 hover:bg-hover active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <span className="w-5 text-right text-xs font-semibold tabular-nums text-fg3">{index + 1}</span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {!disabled && (
        <div className="flex shrink-0 flex-col opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            className="bz-icon-btn bz-icon-btn--sm"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`${name}: yukarı taşı`}
            title="Yukarı taşı"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="bz-icon-btn bz-icon-btn--sm"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={`${name}: aşağı taşı`}
            title="Aşağı taşı"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}
