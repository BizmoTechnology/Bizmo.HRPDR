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

const DEFAULT_DIM_COLOR = { bg: "bg-blue-500/10", text: "text-blue-500", bar: "bg-blue-500" };
const DIMENSION_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  LOGICAL_ALGORITHMIC: { bg: "bg-blue-500/10", text: "text-blue-500", bar: "bg-blue-500" },
  LEADERSHIP: { bg: "bg-purple-500/10", text: "text-purple-500", bar: "bg-purple-500" },
  SOCIAL_INTELLIGENCE: { bg: "bg-emerald-500/10", text: "text-emerald-500", bar: "bg-emerald-500" },
  GROWTH_POTENTIAL: { bg: "bg-amber-500/10", text: "text-amber-500", bar: "bg-amber-500" },
  DOMAIN_ALIGNMENT: { bg: "bg-rose-500/10", text: "text-rose-500", bar: "bg-rose-500" },
};

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
    if (!confirm("Bu soru setini silmek istediğinizden emin misiniz?")) return;
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
      <div className="space-y-6 w-full">
        <div className="h-8 w-48 bg-muted/40 rounded-xl animate-pulse" />
        <div className="h-40 bg-muted/40 rounded-xl animate-pulse" />
        <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!qs) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-muted-foreground">Soru seti bulunamadı</p>
        <button
          onClick={() => router.push("/question-sets")}
          className="mt-3 text-sm text-primary hover:underline"
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
          onClick={() => router.push("/question-sets")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Soru Setleri
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{qs.name}</h1>
            <span className="text-xs tabular-nums text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
              v{qs.version}
            </span>
            {qs.isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[11px] font-semibold">
                <Star className="h-3 w-3 fill-amber-500" />
                Varsayılan
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Soru Ekle
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Düzenle
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Sil
            </button>
          </div>
        </div>

        {qs.description && (
          <p className="text-sm text-muted-foreground mt-2">
            {qs.description}
          </p>
        )}
      </motion.div>

      {/* Dimension Weights */}
      <GlassCard hover={false}>
        <h2 className="text-base font-semibold text-foreground mb-4">
          Boyut Ağırlıkları
        </h2>
        <div className="space-y-3">
          {WEIGHT_MAP.map(({ key, field }) => {
            const w = qsW[field] ?? 0;
            const colors = DIMENSION_COLORS[key] ?? DEFAULT_DIM_COLOR;
            return (
              <div key={key} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-24 sm:w-28 text-xs font-medium shrink-0",
                    colors.text,
                  )}
                >
                  {DIMENSION_SHORT_LABELS[key]}
                </span>
                <div className="flex-1 h-4 rounded-full bg-muted/50 overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", colors.bar)}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(w / maxWeight) * 100}%`,
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ opacity: 0.75 }}
                  />
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground w-8 text-right">
                  {w}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Questions */}
      <GlassCard hover={false}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">
            Sorular ({items.length})
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Bu sette henüz soru yok
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Soru ekle
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {[...items]
              .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
              .map((item: any, idx: number) => {
                const q = item.question;
                if (!q) return null;
                const dimColors =
                  DIMENSION_COLORS[q.dimension] ?? DEFAULT_DIM_COLOR;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex items-center gap-2 pt-0.5 shrink-0">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-xs tabular-nums text-muted-foreground font-medium w-5 text-center">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">
                        {q.text}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span
                          className={cn(
                            "inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold",
                            dimColors.bg,
                            dimColors.text,
                          )}
                        >
                          {DIMENSION_LABELS[q.dimension]}
                        </span>
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                          {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                        </span>
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                          {QUESTION_PHASE_LABELS[q.phase] ?? q.phase}
                        </span>
                        {(item.customWeight ?? q.weight) !== 1 && (
                          <span className="text-[10px] text-muted-foreground/70">
                            Ağırlık: {item.customWeight ?? q.weight}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
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
                className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditOpen(false)}
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="qs-edit-title"
                className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/50 bg-popover p-6 shadow-xl"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-5 flex items-center justify-between">
                  <h3
                    id="qs-edit-title"
                    className="text-lg font-semibold text-foreground"
                  >
                    Soru Setini Düzenle
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="rounded-lg p-1.5 transition-colors hover:bg-muted/60"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={handleEditSubmit(onEditSave)}
                >
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Ad <span className="text-destructive">*</span>
                    </label>
                    <input
                      {...registerEdit("name")}
                      className={cn(
                        "w-full rounded-xl border border-border/40 bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                        editErrors.name && "border-destructive/60",
                      )}
                    />
                    {editErrors.name && (
                      <p className="mt-1 text-xs text-destructive">
                        {editErrors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Açıklama
                    </label>
                    <textarea
                      {...registerEdit("description")}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-border/40 bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        {...registerEdit("isActive")}
                        className="rounded border-border text-primary focus:ring-primary/30"
                      />
                      Aktif
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        {...registerEdit("isDefault")}
                        className="rounded border-border text-primary focus:ring-primary/30"
                      />
                      Varsayılan soru seti
                    </label>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-foreground">
                      Boyut ağırlıkları
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {WEIGHT_MAP.map(({ key, field }) => (
                        <div key={key}>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            {DIMENSION_SHORT_LABELS[key]}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            {...registerEdit(field as keyof EditQsFormValues)}
                            className="w-full rounded-xl border border-border/40 bg-muted/50 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditOpen(false)}
                      className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      {updateMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Kaydet
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
        className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qs-add-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/50 bg-popover shadow-xl"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-5 py-4">
          <h3 id="qs-add-title" className="text-base font-semibold text-foreground">
            Soru Ekle
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-muted/60">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0 border-b border-border/20">
          <button
            onClick={() => setTab("pool")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors border-b-2",
              tab === "pool"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <Library className="h-3.5 w-3.5" />
            Havuzdan Seç
          </button>
          <button
            onClick={() => setTab("ai")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors border-b-2",
              tab === "ai"
                ? "border-purple-500 text-purple-500 bg-purple-500/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI ile Oluştur
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "pool" ? (
            /* ── Havuzdan Seç ── */
            <div className="flex flex-col h-full">
              <div className="shrink-0 px-5 pb-2 pt-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Soru ara..."
                    value={qSearch}
                    onChange={(e) => setQSearch(e.target.value)}
                    className="w-full rounded-xl border border-border/40 bg-muted/50 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {selectedQuestions.length > 0 && (
                  <p className="mt-2 text-xs text-primary">{selectedQuestions.length} soru seçildi</p>
                )}
              </div>
              <div className="flex-1 space-y-1 px-5 pb-2">
                {availableQuestions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {allQuestions.length > 0 ? "Listelenen soruların tümü zaten sette" : "Soru bulunamadı"}
                  </p>
                ) : (
                  availableQuestions.map((q: QuestionRow) => {
                    const selected = selectedQuestions.includes(q.id);
                    const dimColors = DIMENSION_COLORS[q.dimension] ?? DEFAULT_DIM_COLOR;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => toggleQuestion(q.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors",
                          selected ? "bg-primary/10" : "hover:bg-muted/40",
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                          selected ? "border-primary bg-primary" : "border-border/60",
                        )}>
                          {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm text-foreground">{q.text}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold", dimColors.bg, dimColors.text)}>
                              {DIMENSION_SHORT_LABELS[q.dimension]}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{QUESTION_TYPE_LABELS[q.type]}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* ── AI ile Oluştur ── */
            <div className="px-5 py-4 space-y-4">
              {/* Boyut Seçimi */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Boyut Kriteri <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {ALL_DIMENSIONS.map((dim: string) => {
                    const colors = DIMENSION_COLORS[dim] ?? DEFAULT_DIM_COLOR;
                    const isSelected = aiDimension === dim;
                    return (
                      <button
                        key={dim}
                        type="button"
                        onClick={() => setAiDimension(dim)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl p-3 text-left transition-all border-2",
                          isSelected
                            ? `${colors.bg} border-current ${colors.text}`
                            : "border-border/30 hover:border-border/60 hover:bg-muted/30",
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                          isSelected ? "border-current" : "border-border/60",
                        )}>
                          {isSelected && <div className={cn("h-2 w-2 rounded-full", colors.bar)} />}
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-sm font-semibold", isSelected ? colors.text : "text-foreground")}>
                            {DIMENSION_LABELS[dim]}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {DIMENSION_DESCRIPTIONS[dim]}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Soru Tipleri */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Soru Tipleri <span className="text-muted-foreground text-xs font-normal">(boş = tümü)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUESTION_TYPE_OPTIONS.map((opt) => {
                    const active = aiTypes.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleAiType(opt.value)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border",
                          active
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-muted/30 text-muted-foreground border-border/30 hover:bg-muted/50",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Soru Adedi */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Soru Adedi
                </label>
                <div className="flex items-center gap-2">
                  {[3, 5, 7, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAiCount(n)}
                      className={cn(
                        "h-9 w-9 rounded-lg text-sm font-semibold transition-colors",
                        aiCount === n
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ek Bağlam */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Ek Bağlam <span className="text-muted-foreground text-xs font-normal">(isteğe bağlı)</span>
                </label>
                <textarea
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  rows={2}
                  placeholder="Örn: Üretim sektöründe çalışan ekip liderleri için..."
                  className="w-full rounded-xl border border-border/40 bg-muted/50 px-3 py-2 text-sm resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Üret Butonu */}
              <motion.button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-gradient-to-r from-purple-500 to-primary text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generateMutation.isPending ? "AI Soruları Üretiyor..." : "AI ile Soru Üret"}
              </motion.button>

              {/* Üretilen Sorular */}
              {generatedQuestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <BrainCircuit className="h-4 w-4 text-purple-500" />
                      Üretilen Sorular ({generatedQuestions.length})
                    </h4>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedGenerated.length} seçili
                    </p>
                  </div>
                  {generatedQuestions.map((q: QuestionRow, idx: number) => {
                    const selected = selectedGenerated.includes(q.id);
                    const dimColors = DIMENSION_COLORS[q.dimension] ?? DEFAULT_DIM_COLOR;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => toggleGenerated(q.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all border",
                          selected
                            ? "bg-purple-500/5 border-purple-500/30"
                            : "border-border/20 hover:bg-muted/30",
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                          selected ? "border-purple-500 bg-purple-500" : "border-border/60",
                        )}>
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground leading-relaxed">{q.text}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold", dimColors.bg, dimColors.text)}>
                              {DIMENSION_SHORT_LABELS[q.dimension]}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {QUESTION_TYPE_LABELS[q.type]}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {QUESTION_PHASE_LABELS[q.phase]}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-500">
                              <Sparkles className="h-2.5 w-2.5" />
                              AI
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-border/30 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60"
          >
            İptal
          </button>
          {tab === "pool" ? (
            <button
              type="button"
              onClick={() => void handleAddQuestions()}
              disabled={selectedQuestions.length === 0 || updateMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ekle ({selectedQuestions.length})
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleAddGenerated()}
              disabled={selectedGenerated.length === 0 || updateQsMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-primary px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateQsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Sete Ekle ({selectedGenerated.length})
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
