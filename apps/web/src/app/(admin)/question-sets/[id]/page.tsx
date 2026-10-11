"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  X,
  Check,
  Loader2,
  Search,
  Star,
  GripVertical,
  Sparkles,
  BrainCircuit,
  Library,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard, PortalModal } from "@ph/ui";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { dimensionColor } from "@/lib/dimension-colors";
import {
  useQuestionSet,
  useDeleteQuestionSet,
  useUpdateQuestionSet,
  useQuestionList,
  useGenerateAiQuestions,
  type QuestionSetItemRow,
  type QuestionSetDetail,
  type QuestionRow,
} from "@/hooks/use-api";
import {
  DIMENSION_LABELS,
  DIMENSION_SHORT_LABELS,
  QUESTION_TYPE_LABELS,
  QUESTION_PHASE_LABELS,
  ALL_DIMENSIONS,
  DIMENSION_DESCRIPTIONS,
} from "@ph/shared";

const editQsSchema = z.object({
  name: z.string().min(1, "Ad en az 1 karakter").max(300),
  description: z.string().max(2000).optional(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  weightLogical: z.coerce.number().min(0),
  weightLeadership: z.coerce.number().min(0),
  weightSocial: z.coerce.number().min(0),
  weightGrowth: z.coerce.number().min(0),
  weightDomain: z.coerce.number().min(0),
});

type EditQsFormValues = z.infer<typeof editQsSchema>;

const WEIGHT_MAP: { key: string; field: string }[] = [
  { key: "LOGICAL_ALGORITHMIC", field: "weightLogical" },
  { key: "LEADERSHIP", field: "weightLeadership" },
  { key: "SOCIAL_INTELLIGENCE", field: "weightSocial" },
  { key: "GROWTH_POTENTIAL", field: "weightGrowth" },
  { key: "DOMAIN_ALIGNMENT", field: "weightDomain" },
];

/**
 * Mevcut öğelere yeni soruları ekler: sette zaten olan sorular atlanır ve
 * sıra numaraları 1..n olarak yeniden verilir (sunucuda soru ve sıra tekil).
 */
function buildItemsPayload(currentItems: QuestionSetItemRow[], newQuestionIds: string[]) {
  const sorted = [...currentItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const existingIds = new Set(sorted.map((item) => item.question.id));
  const additions = [...new Set(newQuestionIds)].filter((qId) => !existingIds.has(qId));
  const items = [
    ...sorted.map((item) => ({
      questionId: item.question.id,
      isRequired: item.isRequired,
      customWeight: item.customWeight ?? undefined,
    })),
    ...additions.map((questionId) => ({ questionId, isRequired: true, customWeight: undefined })),
  ].map((item, i) => ({ ...item, order: i + 1 }));
  return { items, addedCount: additions.length };
}

export default function QuestionSetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const { data: qs, isLoading } = useQuestionSet(id);

  const deleteMutation = useDeleteQuestionSet();
  const updateMutation = useUpdateQuestionSet();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
    formState: { errors: editErrors },
  } = useForm<EditQsFormValues>({
    resolver: zodResolver(editQsSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
      isDefault: false,
      weightLogical: 20,
      weightLeadership: 20,
      weightSocial: 20,
      weightGrowth: 20,
      weightDomain: 20,
    },
  });

  useEffect(() => {
    if (searchParams.get("edit") === "true") {
      setEditOpen(true);
      router.replace(`/question-sets/${id}`, { scroll: false });
    }
  }, [searchParams, router, id]);

  useEffect(() => {
    if (!qs || !editOpen) return;
    resetEditForm({
      name: qs.name,
      description: qs.description ?? "",
      isActive: qs.isActive ?? true,
      isDefault: qs.isDefault,
      weightLogical: qs.weightLogical ?? 20,
      weightLeadership: qs.weightLeadership ?? 20,
      weightSocial: qs.weightSocial ?? 20,
      weightGrowth: qs.weightGrowth ?? 20,
      weightDomain: qs.weightDomain ?? 20,
    });
  }, [qs, editOpen, resetEditForm]);

  const onEditSave = async (values: EditQsFormValues) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          name: values.name,
          description: values.description?.trim() || undefined,
          isActive: values.isActive,
          isDefault: values.isDefault,
          weightLogical: values.weightLogical,
          weightLeadership: values.weightLeadership,
          weightSocial: values.weightSocial,
          weightGrowth: values.weightGrowth,
          weightDomain: values.weightDomain,
        },
      });
      toast.success("Soru seti güncellendi");
      setEditOpen(false);
    } catch {
      toast.error("Güncelleme başarısız");
    }
  };

  const [qSearch, setQSearch] = useState("");
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  const { data: questionsData } = useQuestionList({
    search: qSearch || undefined,
    pageSize: 50,
  });
  const allQuestions = questionsData?.items ?? [];

  const handleDelete = async () => {
    if (!confirm("Soru seti silinsin mi? Bu işlem geri alınamaz.")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Soru seti silindi");
      router.push("/question-sets");
    } catch {
      toast.error("Silme işlemi başarısız");
    }
  };

  const handleAddQuestions = async () => {
    if (selectedQuestions.length === 0) return;
    try {
      const { items: payload, addedCount } = buildItemsPayload(qs?.items ?? [], selectedQuestions);
      await updateMutation.mutateAsync({ id, data: { items: payload } });
      toast.success(`${addedCount} soru eklendi`);
      setAddOpen(false);
      setSelectedQuestions([]);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Soru ekleme başarısız"));
    }
  };

  const toggleQuestion = (qId: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(qId) ? prev.filter((x) => x !== qId) : [...prev, qId],
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 w-full" aria-busy="true">
        <div className="bz-skeleton h-8 w-48" />
        <div className="bz-skeleton h-40 rounded-2xl" />
        <div className="bz-skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!qs) {
    return (
      <div className="bz-empty py-24">
        <span className="bz-icon-box" aria-hidden="true">
          <Library />
        </span>
        <p className="bz-empty__title">Soru seti bulunamadı</p>
        <p className="bz-empty__text">
          Set silinmiş ya da bağlantı hatalı olabilir.
        </p>
        <button
          type="button"
          onClick={() => router.push("/question-sets")}
          className="bz-btn bz-btn--soft"
        >
          Listeye dön
        </button>
      </div>
    );
  }

  const items: any[] = qs.items ?? [];
  const qsW = qs as QuestionSetDetail & Record<string, number | undefined>;
  const maxWeight = Math.max(
    ...WEIGHT_MAP.map(({ field }) => qsW[field] ?? 0),
    1,
  );

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          type="button"
          onClick={() => router.push("/question-sets")}
          className="bz-btn bz-btn--subtle bz-btn--sm mb-4"
        >
          <ArrowLeft />
          Soru setleri
        </button>

        <div className="bz-page-header mb-0">
          <div className="bz-page-header__text">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="bz-page-header__title">{qs.name}</h1>
              <span className="bz-chip tabular-nums" title="Sürüm">
                v{qs.version}
              </span>
              {qs.isDefault && (
                <span className="bz-chip bz-chip--success">
                  <Star />
                  Varsayılan
                </span>
              )}
            </div>
            {qs.description && (
              <p className="bz-page-header__sub">{qs.description}</p>
            )}
          </div>
          <div className="bz-page-header__actions">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bz-btn bz-btn--danger"
            >
              <Trash2 />
              Sil
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="bz-btn"
            >
              <Pencil />
              Düzenle
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="bz-btn bz-btn--primary"
            >
              <Plus />
              Soru ekle
            </button>
          </div>
        </div>
      </motion.div>

      {/* Dimension Weights */}
      <GlassCard hover={false}>
        <h2 className="text-[15px] font-bold text-foreground mb-4">
          Boyut ağırlıkları
        </h2>
        <div className="space-y-3">
          {WEIGHT_MAP.map(({ key, field }) => {
            const w = qsW[field] ?? 0;
            const colors = dimensionColor(key);
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="flex w-24 sm:w-28 shrink-0 items-center gap-2 text-[13px] text-fg2">
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", colors.bar)}
                    aria-hidden="true"
                  />
                  {DIMENSION_SHORT_LABELS[key]}
                </span>
                <div className="flex-1 h-2 rounded-full bg-field overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", colors.bar)}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(w / maxWeight) * 100}%`,
                    }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums text-foreground w-8 text-right">
                  {w}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Questions */}
      <GlassCard hover={false}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] font-bold text-foreground">
            Sorular{" "}
            <span className="font-sans text-[13px] font-semibold tabular-nums text-fg3">
              {items.length}
            </span>
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="bz-empty">
            <span className="bz-icon-box" aria-hidden="true">
              <Library />
            </span>
            <p className="bz-empty__title">Bu sette henüz soru yok</p>
            <p className="bz-empty__text">
              Havuzdan soru seçin veya AI ile yeni sorular üretin.
            </p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="bz-btn bz-btn--soft"
            >
              <Plus />
              Soru ekle
            </button>
          </div>
        ) : (
          <ol className="divide-y divide-divider">
            {[...items]
              .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
              .map((item: any, idx: number) => {
                const q = item.question;
                if (!q) return null;
                const dimColors = dimensionColor(q.dimension);
                const weight = item.customWeight ?? q.weight;
                return (
                  <li
                    key={item.id}
                    className="group -mx-2 flex items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-hover"
                  >
                    <div className="flex items-center gap-1 pt-0.5 shrink-0">
                      <GripVertical className="h-4 w-4 text-fg3 opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
                      <span className="text-xs tabular-nums text-fg3 font-semibold w-5 text-right">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">
                        {q.text}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                        <span
                          className={cn(
                            "bz-chip text-foreground",
                            dimColors.bg,
                          )}
                        >
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full", dimColors.bar)}
                            aria-hidden="true"
                          />
                          {DIMENSION_LABELS[q.dimension]}
                        </span>
                        <span className="text-xs text-fg3">
                          {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                          {" · "}
                          {QUESTION_PHASE_LABELS[q.phase] ?? q.phase}
                          {weight !== 1 && (
                            <>
                              {" · "}Ağırlık{" "}
                              <b className="tabular-nums">{weight}</b>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
          </ol>
        )}
      </GlassCard>

      {/* Soru ekle — viewport ortasında (havuzdan seç + AI ile oluştur) */}
      <AnimatePresence>
        {addOpen && (
          <PortalModal key="qs-add">
            <AddQuestionDialog
              addOpen={addOpen}
              onClose={() => { setAddOpen(false); setSelectedQuestions([]); }}
              qSearch={qSearch}
              setQSearch={setQSearch}
              allQuestions={allQuestions}
              selectedQuestions={selectedQuestions}
              toggleQuestion={toggleQuestion}
              handleAddQuestions={handleAddQuestions}
              updateMutation={updateMutation}
              existingItems={qs?.items ?? []}
              questionSetId={id}
            />
          </PortalModal>
        )}
      </AnimatePresence>

      {/* Düzenle */}
      <AnimatePresence>
        {editOpen && qs && (
          <PortalModal key="qs-edit">
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                className="bz-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditOpen(false)}
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="qs-edit-title"
                aria-describedby="qs-edit-desc"
                className="relative z-modal max-h-[86vh] w-full max-w-[480px] overflow-y-auto rounded-3xl border border-glass-border bg-popover p-6 shadow-3 backdrop-blur-xl"
                initial={{ opacity: 0, scale: 0.98, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 8 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3
                      id="qs-edit-title"
                      className="font-display text-[19px] font-bold text-foreground"
                    >
                      Soru setini düzenle
                    </h3>
                    <p id="qs-edit-desc" className="mt-1 text-[13px] text-fg2">
                      Ad, açıklama ve boyut ağırlıklarını güncelleyin.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="bz-icon-btn bz-icon-btn--sm -mr-2 -mt-1"
                    aria-label="Kapat"
                    title="Kapat"
                  >
                    <X />
                  </button>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={handleEditSubmit(onEditSave)}
                >
                  <div className="bz-form-row">
                    <label htmlFor="qs-edit-name" className="bz-label">
                      Ad <span className="bz-req">*</span>
                    </label>
                    <input
                      id="qs-edit-name"
                      {...registerEdit("name")}
                      aria-invalid={editErrors.name ? true : undefined}
                      aria-describedby={editErrors.name ? "qs-edit-name-err" : undefined}
                      className="bz-field"
                    />
                    {editErrors.name && (
                      <span id="qs-edit-name-err" className="bz-error-text">
                        {editErrors.name.message}
                      </span>
                    )}
                  </div>

                  <div className="bz-form-row">
                    <label htmlFor="qs-edit-desc-field" className="bz-label">
                      Açıklama
                    </label>
                    <textarea
                      id="qs-edit-desc-field"
                      {...registerEdit("description")}
                      rows={3}
                      className="bz-field"
                    />
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <label className="bz-check">
                      <input type="checkbox" {...registerEdit("isActive")} />
                      Aktif
                    </label>
                    <label className="bz-check">
                      <input type="checkbox" {...registerEdit("isDefault")} />
                      Varsayılan soru seti
                    </label>
                  </div>

                  <fieldset className="bz-fieldset">
                    <legend className="bz-label mb-3">Boyut ağırlıkları</legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {WEIGHT_MAP.map(({ key, field }) => (
                        <div key={key} className="bz-form-row">
                          <label
                            htmlFor={`qs-edit-w-${field}`}
                            className="bz-label flex items-center gap-2 font-medium text-fg2"
                          >
                            <span
                              className={cn("h-2 w-2 rounded-full", dimensionColor(key).bar)}
                              aria-hidden="true"
                            />
                            {DIMENSION_SHORT_LABELS[key]}
                          </label>
                          <input
                            id={`qs-edit-w-${field}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            {...registerEdit(field as keyof EditQsFormValues)}
                            className="bz-field tabular-nums"
                          />
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditOpen(false)}
                      className="bz-btn"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="bz-btn bz-btn--primary"
                    >
                      {updateMutation.isPending && (
                        <Loader2 className="animate-spin" />
                      )}
                      {updateMutation.isPending ? "Kaydediliyor" : "Değişiklikleri kaydet"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Soru Ekle Dialog — Havuzdan Seç + AI ile Oluştur
   ═══════════════════════════════════════════════════════ */

type AddTab = "pool" | "ai";

const QUESTION_TYPE_OPTIONS = [
  { value: "OPEN_ENDED", label: "Açık Uçlu" },
  { value: "SITUATIONAL", label: "Durumsal" },
  { value: "BEHAVIORAL", label: "Davranışsal" },
  { value: "SCALE", label: "Skala" },
  { value: "MULTIPLE_CHOICE", label: "Çoktan Seçmeli" },
];

function AddQuestionDialog({
  addOpen,
  onClose,
  qSearch,
  setQSearch,
  allQuestions,
  selectedQuestions,
  toggleQuestion,
  handleAddQuestions,
  updateMutation,
  existingItems,
  questionSetId,
}: {
  addOpen: boolean;
  onClose: () => void;
  qSearch: string;
  setQSearch: (v: string) => void;
  allQuestions: QuestionRow[];
  selectedQuestions: string[];
  toggleQuestion: (qId: string) => void;
  handleAddQuestions: () => Promise<void>;
  updateMutation: { isPending: boolean };
  existingItems: QuestionSetItemRow[];
  questionSetId: string;
}) {
  const [tab, setTab] = useState<AddTab>("pool");
  // Sette zaten bulunan sorular seçim listesinde gösterilmez
  const existingQuestionIds = new Set(existingItems.map((item) => item.question.id));
  const availableQuestions = allQuestions.filter((q) => !existingQuestionIds.has(q.id));
  const [aiDimension, setAiDimension] = useState<string>(ALL_DIMENSIONS[0]!);
  const [aiTypes, setAiTypes] = useState<string[]>([]);
  const [aiCount, setAiCount] = useState(5);
  const [aiContext, setAiContext] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionRow[]>([]);
  const [selectedGenerated, setSelectedGenerated] = useState<string[]>([]);

  const generateMutation = useGenerateAiQuestions();
  const updateQsMutation = useUpdateQuestionSet();

  const handleGenerate = () => {
    setGeneratedQuestions([]);
    setSelectedGenerated([]);
    generateMutation.mutate(
      {
        dimension: aiDimension,
        questionTypes: aiTypes.length > 0 ? aiTypes : undefined,
        count: aiCount,
        context: aiContext || undefined,
      },
      {
        onSuccess: (data: QuestionRow[]) => {
          setGeneratedQuestions(data);
          setSelectedGenerated(data.map((q) => q.id));
          toast.success(`${data.length} soru AI tarafından üretildi`);
        },
        onError: (err) => {
          toast.error(apiErrorMessage(err, "AI soru üretimi başarısız"));
        },
      },
    );
  };

  const toggleAiType = (t: string) => {
    setAiTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const toggleGenerated = (qId: string) => {
    setSelectedGenerated((prev) =>
      prev.includes(qId) ? prev.filter((x) => x !== qId) : [...prev, qId],
    );
  };

  const handleAddGenerated = async () => {
    if (selectedGenerated.length === 0) return;
    try {
      const { items: payload, addedCount } = buildItemsPayload(existingItems, selectedGenerated);
      await updateQsMutation.mutateAsync({ id: questionSetId, data: { items: payload } });
      toast.success(`${addedCount} AI sorusu sete eklendi`);
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Soru ekleme başarısız"));
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        className="bz-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qs-add-title"
        aria-describedby="qs-add-desc"
        className="relative z-modal flex max-h-[86vh] w-full max-w-[720px] flex-col overflow-hidden rounded-3xl border border-glass-border bg-popover shadow-3 backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h3 id="qs-add-title" className="font-display text-[19px] font-bold text-foreground">
              Soru ekle
            </h3>
            <p id="qs-add-desc" className="mt-1 text-[13px] text-fg2">
              Havuzdan soru seçin veya AI ile yeni sorular üretin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bz-icon-btn bz-icon-btn--sm -mr-2"
            aria-label="Kapat"
            title="Kapat"
          >
            <X />
          </button>
        </div>

        {/* Tabs */}
        <div className="bz-tabs shrink-0 px-4" role="tablist" aria-label="Soru kaynağı">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pool"}
            onClick={() => setTab("pool")}
            className="bz-tab"
          >
            <Library className="h-4 w-4" />
            Havuzdan seç
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "ai"}
            onClick={() => setTab("ai")}
            className="bz-tab"
          >
            <Sparkles className="h-4 w-4" />
            AI ile oluştur
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
          {tab === "pool" ? (
            /* ── Havuzdan Seç ── */
            <div className="flex flex-col h-full">
              <div className="shrink-0 px-6 pb-3 pt-4">
                <div className="bz-input-group">
                  <span className="bz-input-prefix">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="search"
                    placeholder="Soru ara"
                    aria-label="Soru ara"
                    value={qSearch}
                    onChange={(e) => setQSearch(e.target.value)}
                    className="bz-field"
                  />
                </div>
                {selectedQuestions.length > 0 && (
                  <p className="bz-hint mt-2">
                    <b className="tabular-nums">{selectedQuestions.length}</b> soru seçildi
                  </p>
                )}
              </div>
              <div className="flex-1 space-y-2 px-6 pb-4">
                {availableQuestions.length === 0 ? (
                  <div className="bz-empty py-10">
                    <p className="bz-empty__title">
                      {allQuestions.length > 0 ? "Listelenen soruların tümü zaten sette" : "Soru bulunamadı"}
                    </p>
                    <p className="bz-empty__text">Farklı bir arama terimi deneyin.</p>
                  </div>
                ) : (
                  availableQuestions.map((q: QuestionRow) => {
                    const selected = selectedQuestions.includes(q.id);
                    const dimColors = dimensionColor(q.dimension);
                    return (
                      <label key={q.id} className="bz-choice-card w-full py-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleQuestion(q.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm text-foreground">{q.text}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={cn("bz-chip text-foreground", dimColors.bg)}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", dimColors.bar)} aria-hidden="true" />
                              {DIMENSION_SHORT_LABELS[q.dimension]}
                            </span>
                            <span className="text-xs text-fg3">{QUESTION_TYPE_LABELS[q.type]}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ── AI ile Oluştur ── */
            <div className="px-6 py-4 space-y-5">
              {/* Boyut Seçimi */}
              <fieldset className="bz-fieldset gap-2">
                <legend className="bz-label mb-2">
                  Boyut kriteri <span className="bz-req">*</span>
                </legend>
                <div className="grid grid-cols-1 gap-2">
                  {ALL_DIMENSIONS.map((dim: string) => {
                    const colors = dimensionColor(dim);
                    const isSelected = aiDimension === dim;
                    return (
                      <label key={dim} className="bz-choice-card w-full py-3">
                        <input
                          type="radio"
                          name="qs-ai-dimension"
                          checked={isSelected}
                          onChange={() => setAiDimension(dim)}
                        />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", colors.bar)} aria-hidden="true" />
                            {DIMENSION_LABELS[dim]}
                          </p>
                          <p className="text-xs text-fg3 mt-0.5 line-clamp-2">
                            {DIMENSION_DESCRIPTIONS[dim]}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {/* Soru Tipleri */}
              <div className="bz-form-row">
                <span className="bz-label" id="qs-ai-types">
                  Soru tipleri <span className="text-xs font-normal text-fg3">(boş = tümü)</span>
                </span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="qs-ai-types">
                  {QUESTION_TYPE_OPTIONS.map((opt) => {
                    const active = aiTypes.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleAiType(opt.value)}
                        className="bz-chip bz-chip--lg"
                      >
                        {active && <Check aria-hidden="true" />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Soru Adedi */}
              <div className="bz-form-row">
                <span className="bz-label" id="qs-ai-count">Soru adedi</span>
                <div className="bz-segmented self-start" role="group" aria-labelledby="qs-ai-count">
                  {[3, 5, 7, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={aiCount === n}
                      onClick={() => setAiCount(n)}
                      className="min-w-[44px] tabular-nums"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ek Bağlam */}
              <div className="bz-form-row">
                <label htmlFor="qs-ai-context" className="bz-label">
                  Ek bağlam <span className="text-xs font-normal text-fg3">(isteğe bağlı)</span>
                </label>
                <textarea
                  id="qs-ai-context"
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  rows={2}
                  placeholder="Örn: Üretim sektöründe çalışan ekip liderleri için..."
                  className="bz-field"
                />
              </div>

              {/* Üret Butonu */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="bz-btn bz-btn--data bz-btn--block"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {generateMutation.isPending ? "Sorular üretiliyor" : "AI ile soru üret"}
              </button>

              {/* Üretilen Sorular */}
              {generatedQuestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <BrainCircuit className="h-4 w-4 text-data" aria-hidden="true" />
                      Üretilen sorular
                      <span className="tabular-nums text-fg3">{generatedQuestions.length}</span>
                    </h4>
                    <p className="text-xs text-fg3 tabular-nums">
                      {selectedGenerated.length} seçili
                    </p>
                  </div>
                  {generatedQuestions.map((q: QuestionRow) => {
                    const selected = selectedGenerated.includes(q.id);
                    const dimColors = dimensionColor(q.dimension);
                    return (
                      <label key={q.id} className="bz-choice-card w-full py-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleGenerated(q.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground leading-relaxed">{q.text}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={cn("bz-chip text-foreground", dimColors.bg)}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", dimColors.bar)} aria-hidden="true" />
                              {DIMENSION_SHORT_LABELS[q.dimension]}
                            </span>
                            <span className="text-xs text-fg3">
                              {QUESTION_TYPE_LABELS[q.type]} · {QUESTION_PHASE_LABELS[q.phase]}
                            </span>
                            <span className="bz-chip bz-chip--info">
                              <Sparkles />
                              AI
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-divider px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="bz-btn"
          >
            Vazgeç
          </button>
          {tab === "pool" ? (
            <button
              type="button"
              onClick={() => void handleAddQuestions()}
              disabled={selectedQuestions.length === 0 || updateMutation.isPending}
              className="bz-btn bz-btn--primary"
            >
              {updateMutation.isPending && <Loader2 className="animate-spin" />}
              Sete ekle
              <span className="tabular-nums">({selectedQuestions.length})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleAddGenerated()}
              disabled={selectedGenerated.length === 0 || updateQsMutation.isPending}
              className="bz-btn bz-btn--primary"
            >
              {updateQsMutation.isPending && <Loader2 className="animate-spin" />}
              Sete ekle
              <span className="tabular-nums">({selectedGenerated.length})</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
