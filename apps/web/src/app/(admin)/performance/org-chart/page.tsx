"use client";

import { motion } from "framer-motion";
import { AlertCircle, Network } from "lucide-react";
import { OrgChartTree } from "@/components/performance/OrgChartTree";
import { useOrgChart } from "@/hooks/use-reviews";
import { usePermissions } from "@/lib/roles";

export default function OrgChartPage() {
  const { data, isLoading, isError, refetch } = useOrgChart();
  const { canManage } = usePermissions();
  const people = data ?? [];
  const roots = people.filter((p) => !p.managerId).length;

  return (
    <div className="w-full">
      <motion.div
        className="bz-page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">Org şeması</h1>
          <p className="bz-page-header__sub">
            Kimin kime bağlı olduğunu düzenleyin. 360° dönemlerinde yönetici, eş düzey ve ast önerileri buradan gelir.
          </p>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="bz-card space-y-2 p-5" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bz-skeleton h-9 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="bz-card">
          <div className="bz-empty" role="alert">
            <span className="bz-icon-box text-danger">
              <AlertCircle />
            </span>
            <p className="bz-empty__title">Org şeması yüklenemedi</p>
            <button type="button" className="bz-btn bz-btn--soft mt-2" onClick={() => void refetch()}>
              Tekrar dene
            </button>
          </div>
        </div>
      ) : people.length === 0 ? (
        <div className="bz-card">
          <div className="bz-empty">
            <span className="bz-icon-box">
              <Network />
            </span>
            <p className="bz-empty__title">Henüz personel yok</p>
            <p className="bz-empty__text">Personel ekledikten sonra yönetici ilişkilerini burada kurabilirsiniz.</p>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-fg2">
            <b className="text-foreground">{people.length}</b> kişi · <b className="text-foreground">{roots}</b> en üst düzey
            {!canManage && " · Düzenleme yetkiniz yok; şema yalnız görüntülenir."}
          </p>
          <OrgChartTree people={people} canEdit={canManage} />
        </>
      )}
    </div>
  );
}
