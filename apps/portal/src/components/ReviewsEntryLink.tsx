"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { api } from "@/lib/api";

/**
 * 360° değerlendirici görevlerine giriş: bekleyen görev varsa sayısıyla görünür.
 * Karşılama ekranına tek satırla eklenir (portal sayfalarını yeniden tasarlayan PR'larla çakışmasın diye ayrı bileşen).
 */
export function ReviewsEntryLink() {
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get("/api/reviews/portal/assignments")
      .then(({ data }) => {
        if (!alive) return;
        const list: Array<{ status: string }> = data?.data ?? [];
        setPending(list.filter((a) => a.status === "NOT_STARTED" || a.status === "IN_PROGRESS").length);
      })
      .catch(() => alive && setPending(0));
    return () => {
      alive = false;
    };
  }, []);

  if (!pending) return null;
  return (
    <Link
      href="/reviews"
      className="mt-4 flex items-center gap-3 rounded-2xl border border-divider bg-surface-2 px-4 py-3 text-left transition-colors hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="bz-icon-box shrink-0">
        <Users />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-foreground">360° değerlendirmelerim</span>
        <span className="block text-[12.5px] text-fg3">{pending} kişi görüşünüzü bekliyor</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-fg3" aria-hidden="true" />
    </Link>
  );
}
