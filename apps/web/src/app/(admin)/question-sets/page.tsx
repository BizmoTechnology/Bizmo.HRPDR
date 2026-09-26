"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, FileQuestion, Star } from "lucide-react";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import { useQuestionSetList } from "@/hooks/use-api";
import { DIMENSION_SHORT_LABELS } from "@ph/shared";

const DIMENSION_COLORS: Record<string, string> = {
  LOGICAL_ALGORITHMIC: "bg-blue-500",
  LEADERSHIP: "bg-purple-500",
  SOCIAL_INTELLIGENCE: "bg-emerald-500",
  GROWTH_POTENTIAL: "bg-amber-500",
  DOMAIN_ALIGNMENT: "bg-rose-500",
};

const WEIGHT_KEYS: { key: string; field: string }[] = [
  { key: "LOGICAL_ALGORITHMIC", field: "weightLogical" },
  { key: "LEADERSHIP", field: "weightLeadership" },
  { key: "SOCIAL_INTELLIGENCE", field: "weightSocial" },
  { key: "GROWTH_POTENTIAL", field: "weightGrowth" },
  { key: "DOMAIN_ALIGNMENT", field: "weightDomain" },
];

export default function QuestionSetsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuestionSetList({
    search: search || undefined,
  });
  const questionSets = data ?? [];

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Soru Setleri</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Değerlendirme soru setlerini yönetin
          </p>
        </div>
        <button
          onClick={() => router.push("/question-sets/new")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          Yeni Set
        </button>
      </motion.div>

      {/* Search */}
      <GlassCard hover={false} className="!p-3 md:!p-4">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/50 border border-border/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard hover={false}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : questionSets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <FileQuestion className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Henüz soru seti bulunmuyor
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                    Ad
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4 hidden md:table-cell">
                    Açıklama
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4 hidden sm:table-cell">
                    Soru
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4 hidden lg:table-cell">
                    Boyut Ağırlıkları
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                    V.
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3">
                    Varsayılan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {questionSets.map((qs: any) => (
                  <tr
                    key={qs.id}
                    onClick={() => router.push(`/question-sets/${qs.id}`)}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 pr-4">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {qs.name}
                      </p>
                    </td>
                    <td className="py-3.5 pr-4 hidden md:table-cell">
                      <p className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
                        {qs.description || "—"}
                      </p>
                    </td>
                    <td className="py-3.5 pr-4 hidden sm:table-cell">
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {qs.itemCount ?? qs._count?.items ?? "—"}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        {WEIGHT_KEYS.map(({ key, field }) => {
                          // Ağırlıklar 0–100 aralığında (toplam 100); çubuk satırdaki en büyük ağırlığa göre ölçeklenir
                          const w = (qs[field] ?? 0) as number;
                          const maxW = Math.max(
                            1,
                            ...WEIGHT_KEYS.map(({ field: f }) => (qs[f] ?? 0) as number),
                          );
                          const ratio = w / maxW;
                          return (
                            <div
                              key={key}
                              className="flex flex-col items-center gap-0.5"
                              title={`${DIMENSION_SHORT_LABELS[key]}: %${w}`}
                            >
                              <div className="w-6 h-3 rounded-sm overflow-hidden bg-muted/60">
                                <div
                                  className={cn(
                                    "h-full rounded-sm transition-all",
                                    DIMENSION_COLORS[key],
                                  )}
                                  style={{
                                    width: `${Math.round(ratio * 100)}%`,
                                    opacity: 0.55 + ratio * 0.45,
                                  }}
                                />
                              </div>
                              <span className="text-[8px] text-muted-foreground/70 leading-none">
                                {DIMENSION_SHORT_LABELS[key]?.[0]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        v{qs.version}
                      </span>
                    </td>
                    <td className="py-3.5">
                      {qs.isDefault && (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
