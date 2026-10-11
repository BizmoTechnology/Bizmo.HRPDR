"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit, Plus, Pencil, Trash2, Loader2, AlertCircle,
  Star, X, DollarSign, Hash, Shield, RefreshCw,
  FileText, Heart,
} from "lucide-react";
import { GlassCard, StatCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import {
  useAiConfigList,
  useCreateAiConfig,
  useUpdateAiConfig,
  useDeleteAiConfig,
  useSetDefaultAiConfig,
  useAiUsageStats,
  useListAbacusModels,
  useAiPromptTemplates,
  useAiPromptDefaults,
  useCreateAiPromptTemplate,
  useUpdateAiPromptTemplate,
  useDeleteAiPromptTemplate,
  type AbacusModelOption,
  type AiPromptTemplateRow,
} from "@/hooks/use-api";
import { toast } from "sonner";

type Provider = "CLAUDE" | "OPENAI" | "GEMINI" | "ABACUS" | "MOCK";

// Sağlayıcılar kategori olarak renklendirilmez; ad metin renginde, simge nötr kutuda (DESIGN §2.4, §28).
const PROVIDER_META: Record<Provider, { label: string }> = {
  CLAUDE: { label: "Claude (Anthropic)" },
  OPENAI: { label: "OpenAI GPT" },
  GEMINI: { label: "Google Gemini" },
  ABACUS: { label: "Abacus.AI" },
  MOCK: { label: "Mock (Test)" },
};

const usd = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface ModelOption {
  id: string;
  label: string;
  description: string;
}

const PROVIDER_MODELS: Record<Provider, ModelOption[]> = {
  CLAUDE: [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", description: "En güçlü — kodlama, analiz, uzun görevler" },
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", description: "Hız–zeka dengesi, genel amaçlı" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", description: "En hızlı ve ekonomik" },
    { id: "claude-sonnet-4-0", label: "Claude Sonnet 4.0", description: "Önceki nesil dengeli model" },
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", description: "Eski nesil, kararlı" },
  ],
  OPENAI: [
    { id: "gpt-5.4", label: "GPT-5.4", description: "Frontier — akıl yürütme, kodlama, agentic" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", description: "Hızlı, kodlama odaklı" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 Nano", description: "En düşük maliyetli, yüksek hacim" },
    { id: "gpt-5.3-instant", label: "GPT-5.3 Instant", description: "Güncel instant model" },
    { id: "o3", label: "o3", description: "Gelişmiş akıl yürütme (reasoning)" },
    { id: "o4-mini", label: "o4-mini", description: "Hızlı reasoning, matematik/kod" },
  ],
  GEMINI: [
    { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro", description: "En güçlü — uzun bağlam, agentic" },
    { id: "gemini-3.1-flash", label: "Gemini 3.1 Flash", description: "Hızlı ve ekonomik" },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", description: "En düşük gecikme, sınıflandırma" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Önceki nesil thinking model" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Önceki nesil hızlı" },
  ],
  ABACUS: [] as ModelOption[],
  MOCK: [
    { id: "mock-default", label: "Mock Default", description: "Test amaçlı — gerçek çağrı yapmaz" },
  ],
};

interface AiConfig {
  id: string;
  provider: Provider;
  modelName: string;
  purpose?: string;
  isDefault: boolean;
  apiKey?: string;
}

interface UsageStats {
  totalCalls: number;
  totalCost: number;
  perProvider?: Array<{
    provider: string;
    calls: number;
    cost: number;
  }>;
}

const EMPTY_FORM = {
  provider: "CLAUDE" as Provider,
  modelName: "",
  apiKey: "",
  purpose: "",
  isDefault: false,
};

function maskApiKey(key?: string): string {
  if (!key || key.length < 4) return "****";
  return `${"•".repeat(8)}${key.slice(-4)}`;
}

function ConfigFormDialog({
  open,
  onClose,
  editConfig,
}: {
  open: boolean;
  onClose: () => void;
  editConfig?: AiConfig | null;
}) {
  const initialProvider = editConfig?.provider ?? EMPTY_FORM.provider;
  const initialModelName = editConfig?.modelName ?? "";
  const isInitialModelInList =
    initialProvider !== "ABACUS" &&
    PROVIDER_MODELS[initialProvider].some((m) => m.id === initialModelName);

  const [form, setForm] = useState(
    editConfig
      ? {
          provider: editConfig.provider,
          modelName: editConfig.modelName,
          customModel: isInitialModelInList ? "" : initialModelName,
          apiKey: "",
          purpose: editConfig.purpose ?? "",
          isDefault: editConfig.isDefault,
        }
      : { ...EMPTY_FORM, customModel: "" },
  );

  const [abacusModels, setAbacusModels] = useState<ModelOption[]>(() =>
    editConfig?.provider === "ABACUS" && editConfig.modelName
      ? [
          {
            id: editConfig.modelName,
            label: editConfig.modelName,
            description: "Kayıtlı model",
          },
        ]
      : [],
  );

  const modelsForProvider: ModelOption[] =
    form.provider === "ABACUS" ? abacusModels : PROVIDER_MODELS[form.provider];

  const selectedInList = modelsForProvider.some((m) => m.id === form.modelName);

  const showCustomInput =
    form.modelName === "__custom__" ||
    (!selectedInList &&
      form.modelName !== "" &&
      form.modelName !== modelsForProvider[0]?.id);

  const selectValue =
    form.modelName === "__custom__"
      ? "__custom__"
      : selectedInList
        ? form.modelName
        : form.modelName !== ""
          ? "__custom__"
          : "";

  const handleProviderChange = (provider: Provider) => {
    setAbacusModels([]);
    if (provider === "ABACUS") {
      setForm((f) => ({
        ...f,
        provider,
        modelName: "",
        customModel: "",
      }));
    } else {
      const firstModel = PROVIDER_MODELS[provider][0]?.id ?? "";
      setForm((f) => ({
        ...f,
        provider,
        modelName: firstModel,
        customModel: "",
      }));
    }
  };

  const handleModelSelectChange = (value: string) => {
    if (value === "__custom__") {
      setForm((f) => ({ ...f, modelName: "__custom__", customModel: "" }));
    } else if (value === "") {
      setForm((f) => ({ ...f, modelName: "", customModel: "" }));
    } else {
      setForm((f) => ({ ...f, modelName: value, customModel: "" }));
    }
  };

  const listAbacus = useListAbacusModels();
  const isEditing = !!editConfig;

  const mergeAbacusModels = (data: AbacusModelOption[]) => {
    let merged: ModelOption[] = data.map((d) => ({
      id: d.id,
      label: d.label,
      description: d.description,
    }));
    const keep = editConfig?.modelName;
    if (keep && !merged.some((m) => m.id === keep)) {
      merged = [
        { id: keep, label: keep, description: "Kayıtlı model" },
        ...merged,
      ];
    }
    setAbacusModels(merged);
    toast.success(`${merged.length} Abacus RouteLLM modeli yüklendi`);
  };

  const handleLoadAbacusModels = () => {
    const trimmedKey = form.apiKey.trim();
    if (trimmedKey.length >= 8) {
      listAbacus.mutate(
        { apiKey: trimmedKey },
        {
          onSuccess: mergeAbacusModels,
          onError: () => toast.error("Abacus model listesi alınamadı"),
        },
      );
      return;
    }
    if (isEditing && editConfig?.id) {
      listAbacus.mutate(
        { configId: editConfig.id },
        {
          onSuccess: mergeAbacusModels,
          onError: () => toast.error("Abacus model listesi alınamadı"),
        },
      );
      return;
    }
    toast.error("Önce geçerli bir Abacus API anahtarı girin (en az 8 karakter)");
  };

  const resolvedModelName =
    form.modelName === "__custom__" || showCustomInput
      ? form.customModel
      : form.modelName;

  const create = useCreateAiConfig();
  const update = useUpdateAiConfig();
  const isPending =
    create.isPending || update.isPending || listAbacus.isPending;

  const handleSubmit = () => {
    if (!resolvedModelName.trim()) {
      toast.error("Model adı zorunludur");
      return;
    }

    const payload: Record<string, unknown> = {
      provider: form.provider,
      modelName: resolvedModelName,
      purpose: form.purpose || undefined,
      isDefault: form.isDefault,
    };
    if (form.apiKey) payload.apiKey = form.apiKey;

    if (isEditing) {
      update.mutate(
        { id: editConfig!.id, data: payload },
        {
          onSuccess: () => {
            toast.success("Yapılandırma güncellendi");
            onClose();
          },
          onError: () => toast.error("Güncelleme başarısız"),
        },
      );
    } else {
      if (!form.apiKey) {
        toast.error("API anahtarı zorunludur");
        return;
      }
      create.mutate(payload, {
        onSuccess: () => {
          toast.success("Yeni sağlayıcı eklendi");
          onClose();
        },
        onError: () => toast.error("Ekleme başarısız"),
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="bz-scrim" aria-hidden="true" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-config-dialog-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative z-modal max-h-[86vh] w-full max-w-[480px] overflow-y-auto rounded-3xl border border-glass-border bg-popover p-6 shadow-3 backdrop-blur-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="ai-config-dialog-title"
              className="font-display text-[19px] font-bold text-foreground"
            >
              {isEditing ? "Sağlayıcıyı düzenle" : "Yeni sağlayıcı ekle"}
            </h2>
            <p className="mt-1 text-[13px] text-fg2">
              {isEditing
                ? "Model, kullanım amacı ve API anahtarını güncelleyin."
                : "AI sağlayıcısını, modelini ve API anahtarını girin."}
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

        <div className="space-y-4">
          <div className="bz-form-row">
            <label htmlFor="ai-provider" className="bz-label">Sağlayıcı</label>
            <select
              id="ai-provider"
              value={form.provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
              className="bz-field"
            >
              {Object.entries(PROVIDER_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </div>

          <div className="bz-form-row">
            <label htmlFor="ai-api-key" className="bz-label">
              API anahtarı{" "}
              {isEditing && <span className="text-xs font-normal text-fg3">(boş = değiştirme)</span>}
            </label>
            <input
              id="ai-api-key"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder={isEditing ? "Değiştirmek için yeni anahtar girin" : "sk-..."}
              autoComplete="off"
              className="bz-field"
            />
            {form.provider === "ABACUS" && (
              <span className="bz-hint">
                Liste: en az 8 karakterlik anahtarı yazdıysanız onunla çekilir; düzenlemede alan boşsa
                kayıtlı anahtar kullanılır.
              </span>
            )}
          </div>

          {form.provider === "ABACUS" && (
            <button
              type="button"
              onClick={handleLoadAbacusModels}
              disabled={listAbacus.isPending}
              className="bz-btn bz-btn--block"
            >
              {listAbacus.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              RouteLLM modellerini API&apos;den yükle
            </button>
          )}

          <div className="bz-form-row">
            <label htmlFor="ai-model" className="bz-label">Model adı</label>
            <select
              id="ai-model"
              value={selectValue}
              onChange={(e) => handleModelSelectChange(e.target.value)}
              className="bz-field"
            >
              {form.provider === "ABACUS" && modelsForProvider.length === 0 && (
                <option value="" disabled>
                  Liste boş — önce API&apos;den yükleyin veya özel model seçin
                </option>
              )}
              {modelsForProvider.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.description}
                </option>
              ))}
              <option value="__custom__">Özel model adı gir...</option>
            </select>
            {showCustomInput && (
              <input
                type="text"
                aria-label="Özel model adı"
                value={form.customModel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customModel: e.target.value }))
                }
                placeholder={
                  form.provider === "ABACUS"
                    ? "Abacus RouteLLM model ID"
                    : "Özel model ID girin (ör: gpt-5.4-turbo)"
                }
                className="bz-field mt-1"
              />
            )}
          </div>

          <div className="bz-form-row">
            <label htmlFor="ai-purpose" className="bz-label">Kullanım amacı</label>
            <input
              id="ai-purpose"
              type="text"
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              placeholder="Potansiyel analizi, rapor oluşturma..."
              className="bz-field"
            />
          </div>

          <label className="bz-check">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            Varsayılan sağlayıcı olarak ayarla
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="bz-btn">
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="bz-btn bz-btn--primary"
          >
            {isPending && <Loader2 className="animate-spin" />}
            {isEditing ? "Değişiklikleri kaydet" : "Sağlayıcıyı ekle"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AiConfigPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<AiConfig | null>(null);

  const { data: configData, isLoading: configLoading } = useAiConfigList();
  const { data: usageData, isLoading: usageLoading } = useAiUsageStats();
  const deleteConfig = useDeleteAiConfig();
  const setDefault = useSetDefaultAiConfig();

  const configs: AiConfig[] = Array.isArray(configData) ? configData : (configData as any)?.data ?? [];
  const usage = usageData as UsageStats | undefined;

  const handleDelete = (id: string) => {
    if (!confirm("Yapılandırma silinsin mi? Bu işlem geri alınamaz.")) return;
    deleteConfig.mutate(id, {
      onSuccess: () => toast.success("Yapılandırma silindi"),
      onError: () => toast.error("Silme başarısız"),
    });
  };

  const handleSetDefault = (id: string) => {
    setDefault.mutate(id, {
      onSuccess: () => toast.success("Varsayılan sağlayıcı güncellendi"),
      onError: () => toast.error("İşlem başarısız"),
    });
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  const openCreateConfig = () => {
    setEditConfig(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-8 w-full">
      <motion.div
        className="bz-page-header mb-0"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">AI yapılandırması</h1>
          <p className="bz-page-header__sub">
            AI sağlayıcılarını, kullanım istatistiklerini ve analiz promptlarını yönetin
          </p>
        </div>
      </motion.div>

      {/* AI Providers Section */}
      <section aria-labelledby="ai-providers-title">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 id="ai-providers-title" className="text-[17px] font-bold text-foreground">
            AI sağlayıcıları
          </h2>
          <button
            type="button"
            onClick={openCreateConfig}
            className="bz-btn bz-btn--primary"
          >
            <Plus />
            Yeni sağlayıcı
          </button>
        </div>

        {configLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bz-skeleton h-44 rounded-2xl" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <div className="bz-card">
            <div className="bz-empty">
              <span className="bz-icon-box" aria-hidden="true">
                <BrainCircuit />
              </span>
              <p className="bz-empty__title">Henüz AI sağlayıcısı yok</p>
              <p className="bz-empty__text">
                Analiz ve soru üretimi için bir sağlayıcı ekleyin. Test için Mock sağlayıcısını kullanabilirsiniz.
              </p>
              <button type="button" onClick={openCreateConfig} className="bz-btn bz-btn--soft">
                <Plus />
                Yeni sağlayıcı
              </button>
            </div>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {configs.map((cfg) => {
              const providerMeta = PROVIDER_META[cfg.provider] ?? PROVIDER_META.MOCK;
              return (
                <motion.div key={cfg.id} variants={item} className="h-full">
                  <GlassCard hover={false} className="flex h-full flex-col">
                    <div className="flex items-start gap-3">
                      <span className="bz-icon-box" aria-hidden="true">
                        <BrainCircuit />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {providerMeta.label}
                        </p>
                        <p className="font-mono text-xs text-fg2 truncate" title={cfg.modelName}>
                          {cfg.modelName}
                        </p>
                      </div>
                      {cfg.isDefault && (
                        <span className="bz-chip bz-chip--success shrink-0">
                          <Star />
                          Varsayılan
                        </span>
                      )}
                    </div>

                    {cfg.purpose && (
                      <p className="mt-3 text-[13px] text-fg2 line-clamp-2">
                        {cfg.purpose}
                      </p>
                    )}

                    <div className="mt-3 mb-4 flex items-center gap-1.5 text-fg3">
                      <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">API anahtarı:</span>
                      <span className="font-mono text-xs">
                        {maskApiKey(cfg.apiKey)}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center gap-1 border-t border-divider pt-3">
                      {!cfg.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(cfg.id)}
                          disabled={setDefault.isPending}
                          className="bz-btn bz-btn--ghost bz-btn--sm -ml-3"
                        >
                          <Star />
                          Varsayılan yap
                        </button>
                      )}
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setEditConfig(cfg);
                          setDialogOpen(true);
                        }}
                        className="bz-icon-btn bz-icon-btn--sm"
                        title="Düzenle"
                        aria-label={`${providerMeta.label} yapılandırmasını düzenle`}
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cfg.id)}
                        disabled={deleteConfig.isPending}
                        className="bz-icon-btn bz-icon-btn--sm -mr-1.5 hover:text-danger-ink"
                        title="Sil"
                        aria-label={`${providerMeta.label} yapılandırmasını sil`}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>

      {/* Usage Stats Section */}
      <section aria-labelledby="ai-usage-title">
        <h2 id="ai-usage-title" className="text-[17px] font-bold text-foreground mb-4">
          Kullanım istatistikleri
        </h2>

        {usageLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true">
            <div className="bz-skeleton h-32 rounded-2xl" />
            <div className="bz-skeleton h-32 rounded-2xl" />
          </div>
        ) : !usage ? (
          <div className="bz-card">
            <div className="bz-empty">
              <span className="bz-icon-box" aria-hidden="true">
                <AlertCircle />
              </span>
              <p className="bz-empty__title">Kullanım verisi yok</p>
              <p className="bz-empty__text">
                AI çağrısı yapıldığında çağrı sayısı ve maliyet burada görünür.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                title="Toplam çağrı"
                value={(usage.totalCalls ?? 0).toLocaleString("tr-TR")}
                icon={Hash}
              />
              <StatCard
                title="Toplam maliyet"
                value={usd.format(usage.totalCost ?? 0)}
                icon={DollarSign}
              />
            </div>

            {usage.perProvider && usage.perProvider.length > 0 && (
              <div>
                <h3 className="text-[15px] font-bold text-foreground mb-3">
                  Sağlayıcı bazlı dağılım
                </h3>
                <div className="bz-table-wrap">
                  <table className="bz-table">
                    <thead>
                      <tr>
                        <th>Sağlayıcı</th>
                        <th className="is-num">Çağrı sayısı</th>
                        <th className="hidden sm:table-cell">Çağrı payı</th>
                        <th className="is-num">Maliyet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.perProvider.map((row) => {
                        const meta = PROVIDER_META[row.provider as Provider];
                        const share = usage.totalCalls
                          ? Math.round((row.calls / usage.totalCalls) * 100)
                          : 0;
                        return (
                          <tr key={row.provider}>
                            <td className="font-medium text-foreground">
                              {meta?.label ?? row.provider}
                            </td>
                            <td className="is-num">
                              {row.calls.toLocaleString("tr-TR")}
                            </td>
                            <td className="hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="bz-progress bz-progress--data w-28" aria-hidden="true">
                                  <span style={{ "--value": `${share}%` } as React.CSSProperties} />
                                </div>
                                <span className="text-xs tabular-nums text-fg2">%{share}</span>
                              </div>
                            </td>
                            <td className="is-num">{usd.format(row.cost)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Toplam</td>
                        <td className="is-num">{(usage.totalCalls ?? 0).toLocaleString("tr-TR")}</td>
                        <td className="hidden sm:table-cell" />
                        <td className="is-num">{usd.format(usage.totalCost ?? 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Analiz Prompt Şablonları */}
      <PromptTemplatesSection />

      <AnimatePresence>
        {dialogOpen && (
          <ConfigFormDialog
            open={dialogOpen}
            onClose={() => {
              setDialogOpen(false);
              setEditConfig(null);
            }}
            editConfig={editConfig}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Analiz Prompt Şablonları Bölümü
   ═══════════════════════════════════════════════════════ */

// Tür ayrımı: HR PDR nötr, psikolojik analiz veri mavisi (simge `data`, yazı `data-ink`)
const PROMPT_TYPE_META: Record<
  string,
  { label: string; icon: React.ElementType; iconClass: string; labelClass: string }
> = {
  HR_PDR_ANALYSIS: { label: "HR PDR analizi", icon: FileText, iconClass: "text-fg2", labelClass: "text-fg2" },
  PSYCHOLOGICAL_ANALYSIS: { label: "Psikolojik analiz", icon: Heart, iconClass: "text-data", labelClass: "text-data-ink" },
};

const DEFAULT_PROMPT_TYPE_META = PROMPT_TYPE_META["HR_PDR_ANALYSIS"]!;

function PromptTemplatesSection() {
  const { data: templates, isLoading } = useAiPromptTemplates();
  const { data: defaults } = useAiPromptDefaults();
  const deleteTemplate = useDeleteAiPromptTemplate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<AiPromptTemplateRow | null>(null);
  const [createType, setCreateType] = useState<"HR_PDR_ANALYSIS" | "PSYCHOLOGICAL_ANALYSIS" | null>(null);

  const templateList: AiPromptTemplateRow[] = Array.isArray(templates)
    ? templates
    : (templates as any)?.data ?? [];

  const handleDelete = (id: string) => {
    if (!confirm("Prompt şablonu silinsin mi? Bu işlem geri alınamaz.")) return;
    deleteTemplate.mutate(id, {
      onSuccess: () => toast.success("Prompt şablonu silindi"),
      onError: () => toast.error("Silme başarısız"),
    });
  };

  const openCreate = (type: "HR_PDR_ANALYSIS" | "PSYCHOLOGICAL_ANALYSIS") => {
    setEditTemplate(null);
    setCreateType(type);
    setEditDialogOpen(true);
  };

  const openEdit = (tpl: AiPromptTemplateRow) => {
    setEditTemplate(tpl);
    setCreateType(null);
    setEditDialogOpen(true);
  };

  return (
    <section aria-labelledby="ai-prompts-title">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 id="ai-prompts-title" className="text-[17px] font-bold text-foreground">
          Analiz prompt şablonları
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openCreate("HR_PDR_ANALYSIS")}
            className="bz-btn bz-btn--sm"
            title="Yeni HR PDR analiz şablonu"
          >
            <Plus />
            HR PDR
          </button>
          <button
            type="button"
            onClick={() => openCreate("PSYCHOLOGICAL_ANALYSIS")}
            className="bz-btn bz-btn--sm"
            title="Yeni psikolojik analiz şablonu"
          >
            <Plus />
            Psikolojik
          </button>
        </div>
      </div>

      <p className="text-[13px] text-fg2 mb-4 max-w-3xl">
        Oturum cevaplarından AI analizi yapılırken kullanılacak sistem promptlarını burada yönetin.
        Varsayılan şablon yoksa yerleşik prompt kullanılır.
      </p>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="bz-skeleton h-24 rounded-2xl" />
          <div className="bz-skeleton h-24 rounded-2xl" />
        </div>
      ) : templateList.length === 0 ? (
        <div className="bz-card">
          <div className="bz-empty">
            <span className="bz-icon-box" aria-hidden="true">
              <FileText />
            </span>
            <p className="bz-empty__title">Henüz özel prompt şablonu yok</p>
            <p className="bz-empty__text">
              Yerleşik varsayılan promptlar kullanılıyor. Kendi şablonunuzu eklemek için yukarıdaki düğmeleri kullanın.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {templateList.map((tpl) => {
            const meta = PROMPT_TYPE_META[tpl.type] ?? DEFAULT_PROMPT_TYPE_META;
            const Icon = meta.icon;
            return (
              <GlassCard key={tpl.id} hover={false}>
                <div className="flex items-start gap-3">
                  <span className="bz-icon-box" aria-hidden="true">
                    <Icon className={meta.iconClass} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{tpl.name}</p>
                      {tpl.isDefault && (
                        <span className="bz-chip bz-chip--success">
                          <Star />
                          Varsayılan
                        </span>
                      )}
                      {!tpl.isActive && (
                        <span className="bz-chip bz-chip--outline">Pasif</span>
                      )}
                    </div>
                    <p className={cn("text-xs font-medium", meta.labelClass)}>{meta.label}</p>
                    <p className="mt-2 text-xs text-fg3 line-clamp-2 font-mono leading-relaxed">
                      {tpl.systemPrompt.slice(0, 150)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1.5 -mt-1">
                    <button
                      type="button"
                      onClick={() => openEdit(tpl)}
                      className="bz-icon-btn bz-icon-btn--sm"
                      title="Düzenle"
                      aria-label={`${tpl.name} şablonunu düzenle`}
                    >
                      <Pencil />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tpl.id)}
                      disabled={deleteTemplate.isPending}
                      className="bz-icon-btn bz-icon-btn--sm hover:text-danger-ink"
                      title="Sil"
                      aria-label={`${tpl.name} şablonunu sil`}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {editDialogOpen && (
          <PromptTemplateFormDialog
            open={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setEditTemplate(null);
              setCreateType(null);
            }}
            editTemplate={editTemplate}
            createType={createType}
            defaultPrompts={defaults as Record<string, string> | undefined}
          />
        )}
      </AnimatePresence>
    </section>
  );
}


function PromptTemplateFormDialog({
  open,
  onClose,
  editTemplate,
  createType,
  defaultPrompts,
}: {
  open: boolean;
  onClose: () => void;
  editTemplate: AiPromptTemplateRow | null;
  createType: "HR_PDR_ANALYSIS" | "PSYCHOLOGICAL_ANALYSIS" | null;
  defaultPrompts?: Record<string, string>;
}) {
  const isEditing = !!editTemplate;
  const promptType = editTemplate?.type ?? createType ?? "HR_PDR_ANALYSIS";

  const [form, setForm] = useState({
    name: editTemplate?.name ?? "",
    systemPrompt: editTemplate?.systemPrompt ?? "",
    isActive: editTemplate?.isActive ?? true,
    isDefault: editTemplate?.isDefault ?? true,
  });

  const create = useCreateAiPromptTemplate();
  const update = useUpdateAiPromptTemplate();
  const isPending = create.isPending || update.isPending;

  const handleLoadDefault = () => {
    const defaultPrompt = defaultPrompts?.[promptType];
    if (defaultPrompt) {
      setForm((f) => ({ ...f, systemPrompt: defaultPrompt }));
      toast.success("Yerleşik varsayılan prompt yüklendi");
    } else {
      toast.error("Varsayılan prompt bulunamadı");
    }
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Şablon adı zorunludur");
      return;
    }
    if (form.systemPrompt.length < 10) {
      toast.error("Sistem promptu en az 10 karakter olmalıdır");
      return;
    }

    const payload: Record<string, unknown> = {
      type: promptType,
      name: form.name,
      systemPrompt: form.systemPrompt,
      isActive: form.isActive,
      isDefault: form.isDefault,
    };

    if (isEditing) {
      update.mutate(
        { id: editTemplate!.id, data: payload },
        {
          onSuccess: () => {
            toast.success("Prompt şablonu güncellendi");
            onClose();
          },
          onError: () => toast.error("Güncelleme başarısız"),
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          toast.success("Yeni prompt şablonu oluşturuldu");
          onClose();
        },
        onError: () => toast.error("Oluşturma başarısız"),
      });
    }
  };

  if (!open) return null;

  const meta = PROMPT_TYPE_META[promptType] ?? DEFAULT_PROMPT_TYPE_META;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="bz-scrim" aria-hidden="true" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-prompt-dialog-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative z-modal flex max-h-[86vh] w-full max-w-[720px] flex-col overflow-hidden rounded-3xl border border-glass-border bg-popover shadow-3 backdrop-blur-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="bz-icon-box" aria-hidden="true">
              <meta.icon className={meta.iconClass} />
            </span>
            <div>
              <h2
                id="ai-prompt-dialog-title"
                className="font-display text-[19px] font-bold text-foreground"
              >
                {isEditing ? "Prompt şablonunu düzenle" : `Yeni ${meta.label.toLocaleLowerCase("tr")} promptu`}
              </h2>
              <p className="mt-0.5 text-[13px] text-fg2">{meta.label}</p>
            </div>
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5">
          <div className="bz-form-row">
            <label htmlFor="ai-prompt-name" className="bz-label">Şablon adı</label>
            <input
              id="ai-prompt-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Örn: Standart HR PDR analiz promptu"
              className="bz-field"
            />
          </div>

          <div className="bz-form-row">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="ai-prompt-system" className="bz-label">Sistem promptu</label>
              <button
                type="button"
                onClick={handleLoadDefault}
                className="bz-btn bz-btn--ghost bz-btn--sm -mr-3"
              >
                Varsayılanı yükle
              </button>
            </div>
            <textarea
              id="ai-prompt-system"
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              rows={14}
              placeholder="AI'a gönderilecek sistem promptunu yazın..."
              aria-describedby="ai-prompt-system-hint"
              className="bz-field font-mono text-[13px] leading-relaxed"
            />
            <span id="ai-prompt-system-hint" className="bz-hint">
              Bu prompt, oturum cevapları ile birlikte AI modeline gönderilecektir.
              JSON formatında çıktı beklendiğini belirtin.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="bz-check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Aktif
            </label>
            <label className="bz-check">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Varsayılan şablon olarak ayarla
            </label>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-divider px-6 py-4">
          <button type="button" onClick={onClose} className="bz-btn">
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="bz-btn bz-btn--primary"
          >
            {isPending && <Loader2 className="animate-spin" />}
            {isEditing ? "Değişiklikleri kaydet" : "Şablonu oluştur"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
