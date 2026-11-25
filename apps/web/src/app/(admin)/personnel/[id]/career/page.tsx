"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usePersonnel } from "@/hooks/use-api";
import { CareerTab } from "@/components/personnel/CareerTab";

/**
 * Kariyer planı sayfası. Aynı bileşen (CareerTab) personel detayının sekmelerinde de
 * kullanılır; bu rota bağımsız erişim ve doğrudan bağlantı içindir.
 */
export default function PersonnelCareerPage() {
  const { id } = useParams<{ id: string }>();
  const { data: person } = usePersonnel(id);

  return (
    <div className="w-full space-y-4">
      <div className="bz-page-header">
        <Link
          href={`/personnel/${id}`}
          className="bz-icon-btn"
          aria-label="Personel detayına dön"
          title="Personel detayına dön"
        >
          <ArrowLeft />
        </Link>
        <div className="bz-page-header__text min-w-0">
          <h1 className="bz-page-header__title">Kariyer planı</h1>
          <p className="bz-page-header__sub">
            {person ? (
              <>
                {person.firstName} {person.lastName} · {person.position}
              </>
            ) : (
              <span className="bz-skeleton inline-block h-3.5 w-40 align-middle" />
            )}
          </p>
        </div>
      </div>
      <CareerTab personnelId={id} />
    </div>
  );
}
