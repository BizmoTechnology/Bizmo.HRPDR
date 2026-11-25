"use client";

import { useId, useRef } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
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
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CareerStep, CareerStepStatus } from "@/hooks/use-career-plans";
import { CareerDateField } from "./CareerDateField";
import {
  STEP_STATUS_LABEL,
  STEP_TYPE_OPTIONS,
  StepMarker,
  StepStatusToggle,
  stepState,
} from "./career-shared";

/**
 * Taslak adımlarının düzenleyicisi. Sıralama üç yolla yapılır (DESIGN.md §43, §45:
 * sürüklenen her şey klavyeyle de taşınır):
 *  1) Fareyle/dokunmatikle tutamaçtan sürükle-bırak,
 *  2) Tutamaca odaklanıp Boşluk → ↑/↓ → Boşluk (dnd-kit klavye sensörü),
 *  3) Her satırdaki "Yukarı taşı" / "Aşağı taşı" düğmeleri.
 */
export function CareerStepsEditor({
  steps,
  onChange,
  disabled,
}: {
  steps: CareerStep[];
  onChange: (steps: CareerStep[]) => void;
  disabled?: boolean;
}) {
  const instructionsId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: string | number) => {
    const i = steps.findIndex((s) => s.id === id);
    return i >= 0 ? `${i + 1}. adım (${steps[i]!.title || "başlıksız"})` : "adım";
  };
  const position = (id: string | number | undefined) =>
    id === undefined ? 0 : steps.findIndex((s) => s.id === id) + 1;

  // Ekran okuyucu duyuruları (Türkçe)
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${titleOf(active.id)} tutuldu.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)} ${position(over.id)}. sıraya geldi.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} ${position(over.id)}. sıraya bırakıldı.` : `${titleOf(active.id)} bırakıldı.`,
    onDragCancel: ({ active }) => `Taşıma iptal edildi; ${titleOf(active.id)} yerinde kaldı.`,
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= steps.length || from === to) return;
    onChange(arrayMove(steps, from, to));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(
      steps.findIndex((s) => s.id === active.id),
      steps.findIndex((s) => s.id === over.id),
    );
  };

  const patch = (id: string, change: Partial<CareerStep>) =>
    onChange(steps.map((s) => (s.id === id ? { ...s, ...change } : s)));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Adımı taşımak için Boşluk tuşuna basın, ok tuşlarıyla yeni sıraya götürün ve yeniden Boşluk ile bırakın. Esc taşımayı iptal eder.",
        },
      }}
    >
      <p id={instructionsId} className="bz-sr-only">
        Adımlar sürüklenerek ya da Yukarı/Aşağı taşı düğmeleriyle sıralanır.
      </p>
      <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol className="bz-vsteps" aria-describedby={instructionsId}>
          {steps.map((step, index) => (
            <SortableStep
              key={step.id}
              step={step}
              index={index}
              count={steps.length}
              disabled={disabled}
              onPatch={(c) => patch(step.id, c)}
              onMove={(dir) => move(index, index + dir)}
              onRemove={() => onChange(steps.filter((s) => s.id !== step.id))}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableStep({
  step,
  index,
  count,
  disabled,
  onPatch,
  onMove,
  onRemove,
}: {
  step: CareerStep;
  index: number;
  count: number;
  disabled?: boolean;
  onPatch: (change: Partial<CareerStep>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id, disabled });
  const n = index + 1;
  const label = `${n}. adım`;
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const upRef = useRef<HTMLButtonElement | null>(null);
  const downRef = useRef<HTMLButtonElement | null>(null);
  // Düğmeyle taşıdıktan sonra uçta düğme pasifleşirse odak kaybolmasın: tutamaca geçer
  const moveAndKeepFocus = (dir: -1 | 1) => {
    onMove(dir);
    requestAnimationFrame(() => {
      const btn = dir === -1 ? upRef.current : downRef.current;
      if (btn?.disabled) handleRef.current?.focus();
    });
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("bz-vstep", isDragging && "is-dragging relative z-10")}
      data-state={stepState(step.status)}
      aria-current={step.status === "IN_PROGRESS" ? "step" : undefined}
    >
      <StepMarker status={step.status} index={index} />
      <div
        className={cn(
          "min-w-0 rounded-xl border border-border bg-card p-2.5 shadow-sm transition-shadow sm:p-3",
          isDragging && "shadow-3 ring-2 ring-[var(--bz-accent)]",
        )}
      >
        {/* Dar ekranda başlık ikinci satıra iner; tutamaç ve eylemler üstte kalır */}
        <div className="flex flex-wrap items-start gap-2">
          <button
            type="button"
            ref={(el) => {
              setActivatorNodeRef(el);
              handleRef.current = el;
            }}
            {...attributes}
            {...listeners}
            disabled={disabled}
            className="bz-icon-btn bz-icon-btn--sm mt-0.5 flex-none cursor-grab touch-none active:cursor-grabbing"
            aria-label={`${label}: sürükleyerek taşı`}
            title="Sürükleyerek taşı (klavye: Boşluk, ok tuşları, Boşluk)"
          >
            <GripVertical aria-hidden="true" />
          </button>
          <input
            className="bz-field order-last h-9 min-w-0 basis-full text-[14px] font-semibold min-[480px]:order-none min-[480px]:basis-0 min-[480px]:flex-1"
            value={step.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            placeholder="Adım başlığı, ör. Liderlik eğitimi"
            aria-label={`${label}: başlık`}
            maxLength={200}
            disabled={disabled}
          />
          <div className="ml-auto flex flex-none items-center">
            <button
              type="button"
              className="bz-icon-btn bz-icon-btn--sm"
              ref={upRef}
              onClick={() => moveAndKeepFocus(-1)}
              disabled={disabled || index === 0}
              aria-label={`${label}: yukarı taşı`}
              title="Yukarı taşı"
            >
              <ArrowUp aria-hidden="true" />
            </button>
            <button
              type="button"
              className="bz-icon-btn bz-icon-btn--sm"
              ref={downRef}
              onClick={() => moveAndKeepFocus(1)}
              disabled={disabled || index === count - 1}
              aria-label={`${label}: aşağı taşı`}
              title="Aşağı taşı"
            >
              <ArrowDown aria-hidden="true" />
            </button>
            <button
              type="button"
              className="bz-icon-btn bz-icon-btn--sm text-[var(--bz-danger-ink)]"
              onClick={onRemove}
              disabled={disabled}
              aria-label={`${label}: sil`}
              title="Adımı sil"
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="bz-field bz-field--sm w-full min-[420px]:w-[9.5rem]"
            value={step.type}
            onChange={(e) => onPatch({ type: e.target.value as CareerStep["type"] })}
            aria-label={`${label}: tür`}
            disabled={disabled}
          >
            {STEP_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <CareerDateField
            value={step.targetDate}
            onChange={(v) => onPatch({ targetDate: v })}
            label={`${label}: hedef tarih`}
            disabled={disabled}
            className="w-full min-[420px]:w-[11.5rem]"
          />
          <StepStatusToggle
            value={step.status}
            onChange={(s: CareerStepStatus) => onPatch({ status: s })}
            label={`${label}: durum`}
            disabled={disabled}
          />
        </div>

        <textarea
          className="bz-field mt-2 min-h-[44px] text-[13px]"
          rows={1}
          value={step.note ?? ""}
          onChange={(e) => onPatch({ note: e.target.value })}
          placeholder="Not (isteğe bağlı): kaynak, sorumlu, başarı ölçütü"
          aria-label={`${label}: not`}
          maxLength={1000}
          disabled={disabled}
        />
        <span className="bz-sr-only">Durum: {STEP_STATUS_LABEL[step.status]}</span>
      </div>
    </li>
  );
}
