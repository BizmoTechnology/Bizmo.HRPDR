"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, FileQuestion, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuestionSetList } from "@/hooks/use-api";
import { dimensionColor } from "@/lib/dimension-colors";
import { DIMENSION_SHORT_LABELS } from "@ph/shared";

const WEIGHT_KEYS: { key: string; field: string }[] = [
  { key: "LOGICAL_ALGORITHMIC", field: "weightLogical" },
  { key: "LEADERSHIP", field: "weightLeadership" },
  { key: "SOCIAL_INTELLIGENCE", field: "weightSocial" },
  { key: "GROWTH_POTENTIAL", field: "weightGrowth" },
  { key: "DOMAIN_ALIGNMENT", field: "weightDomain" },
];

/** Boyut ağırlıklarının dağılımı: tek satır yığılmış çubuk (seri rengi yalnız işarette) */
function WeightBar({ qs }: { qs: Record<string, unknown> }) {
  const weights = WEIGHT_KEYS.map(({ key, field }) => ({
    key,
    w: Number(qs[field] ?? 0),
  }));
  const total = weights.reduce((a, x) => a + x.w, 0);
  const summary = weights
    .map(({ key, w }) => `${DIMENSION_SHORT_LABELS[key]} ${w}`)
    .join(", ");
  return (
    <div
      className="flex h-2 w-40 gap-0.5 overflow-hidden rounded-full bg-field"
      role="img"
      aria-label={`Boyut ağırlıkları: ${summary}`}
      title={summary}
    >
      {total > 0 &&
        weights.map(({ key, w }) =>
          w > 0 ? (
            <span
              key={key}
              className={cn("h-full", dimensionColor(key).bar)}
              style={{ width: `${(w / total) * 100}%` }}
            />
          ) : null,
        )}
    </div>
  );
}

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
        className="bz-page-header mb-0"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">Soru setleri</h1>
          <p className="bz-page-header__sub">
            Değerlendirme soru setlerini yönetin
          </p>
        </div>
        <div className="bz-page-header__actions">
          <button
            type="button"
            onClick={() => router.push("/question-sets/new")}
            className="bz-btn bz-btn--primary"
          >
            <Plus />
            Yeni set
          </button>
        </div>
      </motion.div>

      {/* Araç çubuğu: arama + boyut lejantı */}
      <div className="bz-toolbar">
        <div className="bz-input-group w-full sm:w-72">
          <span className="bz-input-prefix">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="search"
            placeholder="Soru seti ara"
            aria-label="Soru seti ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bz-field bz-field--sm"
          />
        </div>
        <div className="bz-toolbar__spacer" />
        <ul
          className="hidden lg:flex items-center gap-3 pr-2 text-xs text-fg2"
          aria-label="Boyut renkleri"
        >
          {WEIGHT_KEYS.map(({ key }) => (
            <li key={key} className="flex items-center gap-1.5">
              <span
                className={cn("h-2 w-2 rounded-full", dimensionColor(key).bar)}
                aria-hidden="true"
              />
              {DIMENSION_SHORT_LABELS[key]}
            </li>
          ))}
        </ul>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bz-table-wrap p-4 space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bz-skeleton h-10" />
          ))}
        </div>
      ) : questionSets.length === 0 ? (
        <div className="bz-card">
          <div className="bz-empty">
            <span className="bz-icon-box" aria-hidden="true">
              <FileQuestion />
            </span>
            <p className="bz-empty__title">
              {search ? "Eşleşen soru seti yok" : "Henüz soru seti yok"}
            </p>
            <p className="bz-empty__text">
              {search
                ? "Farklı bir arama terimi deneyin."
                : "İlk soru setinizi oluşturun; değerlendirmelerde buradan seçebilirsiniz."}
            </p>
            {!search && (
              <button
                type="button"
                onClick={() => router.push("/question-sets/new")}
                className="bz-btn bz-btn--soft"
              >
                <Plus />
                Yeni set
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bz-table-wrap">
          <table className="bz-table">
            <thead>
              <tr>
                <th>Ad</th>
                <th className="hidden md:table-cell">Açıklama</th>
                <th className="is-num hidden sm:table-cell">Soru</th>
                <th className="hidden lg:table-cell">Boyut ağırlıkları</th>
                <th className="is-num hidden sm:table-cell">Sürüm</th>
                <th>Varsayılan</th>
              </tr>
            </thead>
            <tbody>
              {questionSets.map((qs: any) => (
                <tr
                  key={qs.id}
                  onClick={() => router.push(`/question-sets/${qs.id}`)}
                  className="cursor-pointer"
                >
                  <td className="min-w-[10rem] whitespace-normal py-2.5 font-semibold text-foreground">
                    {qs.name}
                  </td>
                  <td className="hidden md:table-cell">
                    {qs.description ? (
                      <span className="block max-w-xs truncate text-fg2">
                        {qs.description}
                      </span>
                    ) : (
                      <span className="is-muted">—</span>
                    )}
                  </td>
                  <td className="is-num hidden sm:table-cell">
                    {qs.itemCount ?? qs._count?.items ?? "—"}
                  </td>
                  <td className="hidden lg:table-cell">
                    <WeightBar qs={qs} />
                  </td>
                  <td className="is-num hidden sm:table-cell text-fg2">v{qs.version}</td>
                  <td>
                    {qs.isDefault ? (
                      <span className="bz-chip bz-chip--success">
                        <Star />
                        Varsayılan
                      </span>
                    ) : (
                      <span className="is-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
