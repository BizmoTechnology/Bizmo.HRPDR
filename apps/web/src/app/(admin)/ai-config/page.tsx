"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit, Plus, Pencil, Trash2, Loader2, AlertCircle,
  Star, X, Activity, DollarSign, Hash, Shield, RefreshCw,
  FileText, Heart, Check, PlugZap,
} from "lucide-react";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import {
  useAiConfigList,
  useCreateAiConfig,
  useUpdateAiConfig,
  useDeleteAiConfig,
  useSetDefaultAiConfig,
  useAiUsageStats,
  useTestAiConfig,
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

const PROVIDER_META: Record<Provider, { label: string; color: string }> = {
  CLAUDE: { label: "Claude (Anthropic)", color: "text-accent-purple" },
  OPENAI: { label: "OpenAI GPT", color: "text-accent-green" },
  GEMINI: { label: "Google Gemini", color: "text-primary" },
  ABACUS: { label: "Abacus.AI", color: "text-accent-orange" },
  MOCK: { label: "Mock (Test)", color: "text-muted-foreground" },
};

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
  isActive?: boolean;
  /** Sunucu tarafından maskelenmiş anahtar (ör. ****abcd) */
  maskedApiKey?: string;
}

/** GET /api/ai-config/usage yanıtı */
interface UsageStats {
  totalCalls: number;
  totalCostUsd: number;
  byProvider?: Array<{
    provider: string;
    calls: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

const EMPTY_FORM = {
  provider: "CLAUDE" as Provider,
  modelName: "",
  apiKey: "",
  purpose: "",
  isDefault: false,
};

function formatMaskedKey(masked?: string): string {
  if (!masked) return "••••";
  return masked.replace(/^\*+/, "•".repeat(8));
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
          onError: (err) => toast.error(apiErrorMessage(err, "Abacus model listesi alınamadı")),
        },
      );
      return;
    }
    if (isEditing && editConfig?.id) {
      listAbacus.mutate(
        { configId: editConfig.id },
        {
          onSuccess: mergeAbacusModels,
          onError: (err) => toast.error(apiErrorMessage(err, "Abacus model listesi alınamadı")),
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
      // Sunucu boş amaç için "general" varsayılanını kullanır
      purpose: form.purpose.trim() || (isEditing ? undefined : "general"),
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
          onError: (err) => toast.error(apiErrorMessage(err, "Güncelleme başarısız")),
        },
      );
    } else {
      // MOCK sağlayıcı gerçek çağrı yapmadığı için anahtar gerektirmez
      if (!form.apiKey && form.provider !== "MOCK") {
        toast.error("API anahtarı zorunludur");
        return;
      }
      create.mutate(payload, {
        onSuccess: () => {
          toast.success("Yeni sağlayıcı eklendi");
          onClose();
        },
        onError: (err) => toast.error(apiErrorMessage(err, "Ekleme başarısız")),
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md mx-4"
      >
        <GlassCard className="rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              {isEditing ? "Sağlayıcıyı Düzenle" : "Yeni Sağlayıcı Ekle"}
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Sağlayıcı</label>
              <select
                value={form.provider}
                onChange={(e) => handleProviderChange(e.target.value as Provider)}
                className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/50 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {Object.entries(PROVIDER_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                API Anahtarı {isEditing && <span className="text-muted-foreground font-normal">(boş = değiştirme)</span>}
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={isEditing ? "Değiştirmek için yeni key girin" : "sk-..."}
                className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/50 text-sm
                  placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {form.provider === "ABACUS" && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Liste: en az 8 karakterlik anahtarı yazdıysanız onunla çekilir; düzenlemede alan boşsa
                  kayıtlı anahtar kullanılır.
                </p>
              )}
            </div>

            {form.provider === "ABACUS" && (
              <button
                type="button"
                onClick={handleLoadAbacusModels}
                disabled={listAbacus.isPending}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-border/50 text-sm font-medium
                  text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {listAbacus.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-accent-orange" />
                )}
                RouteLLM modellerini API&apos;den yükle
              </button>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Model Adı</label>
              <select
                value={selectValue}
                onChange={(e) => handleModelSelectChange(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/50 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                  value={form.customModel}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customModel: e.target.value }))
                  }
                  placeholder={
                    form.provider === "ABACUS"
                      ? "Abacus RouteLLM model ID"
                      : "Özel model ID girin (ör: gpt-5.4-turbo)"
                  }
                  className="mt-2 w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/50 text-sm
                    placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Kullanım Amacı</label>
              <input
                type="text"
                value={form.purpose}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                placeholder="Potansiyel analizi, rapor oluşturma..."
                className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/50 text-sm
                  placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-foreground">Varsayılan sağlayıcı olarak ayarla</span>
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-border/50 text-sm font-medium
                text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              İptal
            </button>
            <motion.button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold
                hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Güncelle" : "Ekle"}
            </motion.button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

export default function AiConfigPage() {
  const { canConfigureAi } = usePermissions();
  if (!canConfigureAi) {
    return (
      <GlassCard hover={false} className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">AI yapılandırmasına erişim yetkiniz yok</p>
        <p className="text-xs text-muted-foreground mt-1">Bu bölüm yalnızca yöneticiler içindir.</p>
      </GlassCard>
    );
  }
  return <AiConfigContent />;
}

function AiConfigContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<AiConfig | null>(null);

  const { data: configData, isLoading: configLoading } = useAiConfigList();
  const { data: usageData, isLoading: usageLoading } = useAiUsageStats();
  const deleteConfig = useDeleteAiConfig();
  const setDefault = useSetDefaultAiConfig();
  const testConfig = useTestAiConfig();

  const handleTest = (id: string) => {
    testConfig.mutate(id, {
      onSuccess: (res) => toast.success(`Bağlantı başarılı (${res.latencyMs} ms)`),
      onError: (err) => toast.error(apiErrorMessage(err, "Bağlantı testi başarısız")),
    });
  };

  const configs: AiConfig[] = Array.isArray(configData) ? configData : (configData as any)?.data ?? [];
  const usage = usageData as UsageStats | undefined;

  const handleDelete = (id: string) => {
    if (!confirm("Bu yapılandırmayı silmek istediğinize emin misiniz?")) return;
    deleteConfig.mutate(id, {
      onSuccess: () => toast.success("Yapılandırma silindi"),
      onError: (err) => toast.error(apiErrorMessage(err, "Silme başarısız")),
    });
  };

  const handleSetDefault = (id: string) => {
    setDefault.mutate(id, {
      onSuccess: () => toast.success("Varsayılan sağlayıcı güncellendi"),
      onError: (err) => toast.error(apiErrorMessage(err, "İşlem başarısız")),
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

  return (
    <div className="space-y-6 w-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-foreground">AI Yapılandırması</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          AI sağlayıcılarını ve kullanım istatistiklerini yönetin
        </p>
      </motion.div>

      {/* AI Providers Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-primary" />
            AI Sağlayıcıları
          </h2>
          <motion.button
            onClick={() => {
              setEditConfig(null);
              setDialogOpen(true);
            }}
            className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold
              hover:bg-primary/90 transition-all flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="h-4 w-4" />
            Yeni Sağlayıcı Ekle
          </motion.button>
        </div>

        {configLoading ? (
          <GlassCard hover={false} className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-3 text-sm text-muted-foreground">Yükleniyor...</span>
          </GlassCard>
        ) : configs.length === 0 ? (
          <GlassCard hover={false} className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
              <BrainCircuit className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Henüz AI sağlayıcısı eklenmemiş</p>
          </GlassCard>
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
                <motion.div key={cfg.id} variants={item}>
                  <GlassCard className="relative">
                    {cfg.isDefault && (
                      <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-accent-green/10 text-accent-green flex items-center gap-1">
                        <Star className="h-2.5 w-2.5" />
                        Varsayılan
                      </span>
                    )}

                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <BrainCircuit className={cn("h-5 w-5", providerMeta.color)} />
                      </div>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-semibold", providerMeta.color)}>
                          {providerMeta.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {cfg.modelName}
                        </p>
                      </div>
                    </div>

                    {cfg.purpose && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {cfg.purpose}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 mb-4">
                      <Shield className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[11px] text-muted-foreground/60 font-mono">
                        {cfg.provider === "MOCK" ? "anahtar gerekmez" : formatMaskedKey(cfg.maskedApiKey)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 border-t border-border/20 pt-3">
                      {!cfg.isDefault && (
                        <button
                          onClick={() => handleSetDefault(cfg.id)}
                          disabled={setDefault.isPending}
                          className="text-[11px] text-primary hover:underline underline-offset-4 flex items-center gap-1"
                        >
                          <Star className="h-3 w-3" />
                          Varsayılan yap
                        </button>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={() => handleTest(cfg.id)}
                        disabled={testConfig.isPending}
                        className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50"
                        title="Bağlantıyı test et"
                      >
                        {testConfig.isPending && testConfig.variables === cfg.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <PlugZap className="h-3.5 w-3.5 text-primary" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setEditConfig(cfg);
                          setDialogOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                        title="Düzenle"
                      >
                        <Pencil className="h-3.5 w-3.5 text-primary" />
                      </button>
                      <button
                        onClick={() => handleDelete(cfg.id)}
                        disabled={deleteConfig.isPending}
                        className="p-1.5 rounded-lg hover:bg-accent-red/10 transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-accent-red" />
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Usage Stats Section */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Kullanım İstatistikleri
        </h2>

        {usageLoading ? (
          <GlassCard hover={false} className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </GlassCard>
        ) : !usage ? (
          <GlassCard hover={false} className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Kullanım verisi bulunamadı</p>
          </GlassCard>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <GlassCard hover={false} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Hash className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Toplam Çağrı</p>
                  <p className="text-xl font-bold tabular-nums">
                    {(usage.totalCalls ?? 0).toLocaleString("tr-TR")}
                  </p>
                </div>
              </GlassCard>

              <GlassCard hover={false} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent-green/10 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-5 w-5 text-accent-green" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Toplam Maliyet</p>
                  <p className="text-xl font-bold tabular-nums">
                    ${Number(usage.totalCostUsd ?? 0).toFixed(2)}
                  </p>
                </div>
              </GlassCard>
            </div>

            {usage.byProvider && usage.byProvider.length > 0 && (
              <GlassCard hover={false}>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Sağlayıcı Bazlı Dağılım
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        {["Sağlayıcı", "Çağrı Sayısı", "Token (girdi/çıktı)", "Maliyet"].map((h) => (
                          <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {usage.byProvider.map((row) => {
                        const meta = PROVIDER_META[row.provider as Provider];
                        return (
                          <tr key={row.provider} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 pr-4">
                              <span className={cn("text-sm font-medium", meta?.color ?? "text-foreground")}>
                                {meta?.label ?? row.provider}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="text-sm tabular-nums text-muted-foreground">
                                {row.calls.toLocaleString("tr-TR")}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className="text-sm tabular-nums text-muted-foreground">
                                {row.inputTokens.toLocaleString("tr-TR")} / {row.outputTokens.toLocaleString("tr-TR")}
                              </span>
                            </td>
                            <td className="py-3">
                              <span className="text-sm tabular-nums text-muted-foreground">
                                ${Number(row.costUsd ?? 0).toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>

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

const PROMPT_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  HR_PDR_ANALYSIS: { label: "HR PDR Analizi", icon: FileText, color: "text-primary" },
  PSYCHOLOGICAL_ANALYSIS: { label: "Psikolojik Analiz", icon: Heart, color: "text-purple-500" },
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
    if (!confirm("Bu prompt şablonunu silmek istediğinize emin misiniz?")) return;
    deleteTemplate.mutate(id, {
      onSuccess: () => toast.success("Prompt şablonu silindi"),
      onError: (err) => toast.error(apiErrorMessage(err, "Silme başarısız")),
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" />
          Analiz Prompt Şablonları
        </h2>
        <div className="flex gap-2">
          <motion.button
            onClick={() => openCreate("HR_PDR_ANALYSIS")}
            className="h-9 px-4 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-all flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="h-4 w-4" />
            HR PDR
          </motion.button>
          <motion.button
            onClick={() => openCreate("PSYCHOLOGICAL_ANALYSIS")}
            className="h-9 px-4 rounded-xl bg-purple-500/10 text-purple-500 text-sm font-medium hover:bg-purple-500/20 transition-all flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="h-4 w-4" />
            Psikolojik
          </motion.button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Oturum cevaplarından AI analizi yapılırken kullanılacak sistem promptlarını burada yönetin.
        Varsayılan şablon yoksa yerleşik prompt kullanılır.
      </p>

      {isLoading ? (
        <GlassCard hover={false} className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </GlassCard>
      ) : templateList.length === 0 ? (
        <GlassCard hover={false} className="flex flex-col items-center justify-center py-10">
          <BrainCircuit className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-1">Henüz özel prompt şablonu yok</p>
          <p className="text-xs text-muted-foreground/60">Yerleşik varsayılan promptlar kullanılıyor</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {templateList.map((tpl) => {
            const meta = PROMPT_TYPE_META[tpl.type] ?? DEFAULT_PROMPT_TYPE_META;
            const Icon = meta.icon;
            return (
              <GlassCard key={tpl.id} className="relative">
                <div className="flex items-start gap-3">
                  <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    tpl.type === "HR_PDR_ANALYSIS" ? "bg-primary/10" : "bg-purple-500/10"
                  )}>
                    <Icon className={cn("h-4.5 w-4.5", meta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{tpl.name}</p>
                      {tpl.isDefault && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-accent-green/10 text-accent-green flex items-center gap-1">
                          <Star className="h-2.5 w-2.5" />
                          Varsayılan
                        </span>
                      )}
                      {!tpl.isActive && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          Pasif
                        </span>
                      )}
                    </div>
                    <p className={cn("text-[11px] font-medium", meta.color)}>{meta.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                      {tpl.systemPrompt.slice(0, 150)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(tpl)}
                      className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                      title="Düzenle"
                    >
                      <Pencil className="h-3.5 w-3.5 text-primary" />
                    </button>
                    <button
                      onClick={() => handleDelete(tpl.id)}
                      disabled={deleteTemplate.isPending}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
    </div>
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
          onError: (err) => toast.error(apiErrorMessage(err, "Güncelleme başarısız")),
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          toast.success("Yeni prompt şablonu oluşturuldu");
          onClose();
        },
        onError: (err) => toast.error(apiErrorMessage(err, "Oluşturma başarısız")),
      });
    }
  };

  if (!open) return null;

  const meta = PROMPT_TYPE_META[promptType] ?? DEFAULT_PROMPT_TYPE_META;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
      >
        <GlassCard className="rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <meta.icon className={cn("h-5 w-5", meta.color)} />
              <h2 className="text-lg font-semibold text-foreground">
                {isEditing ? "Prompt Şablonunu Düzenle" : `Yeni ${meta.label} Promptu`}
              </h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Şablon Adı</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Örn: Standart HR PDR Analiz Promptu"
                className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/50 text-sm
                  placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-foreground">Sistem Promptu</label>
                <button
                  type="button"
                  onClick={handleLoadDefault}
                  className="text-xs text-primary hover:underline underline-offset-4"
                >
                  Varsayılanı Yükle
                </button>
              </div>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                rows={14}
                placeholder="AI'a gönderilecek sistem promptunu yazın..."
                className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-sm font-mono leading-relaxed
                  placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Bu prompt, oturum cevapları ile birlikte AI modeline gönderilecektir.
                JSON formatında çıktı beklendiğini belirtin.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-foreground">Aktif</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-foreground">Varsayılan şablon olarak ayarla</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-border/50 text-sm font-medium
                text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              İptal
            </button>
            <motion.button
              onClick={handleSubmit}
              disabled={isPending}
              className={cn(
                "flex-1 h-10 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                promptType === "PSYCHOLOGICAL_ANALYSIS" ? "bg-purple-500 hover:bg-purple-500/90" : "bg-primary hover:bg-primary/90",
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Güncelle" : "Oluştur"}
            </motion.button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
