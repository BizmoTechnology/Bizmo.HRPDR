"use client";

import { AiChatWorkArea } from "@/components/ai-chat/AiChatWorkArea";

export default function AiChatPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[480px] flex-col gap-4">
      <div className="bz-page-header mb-0 shrink-0">
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">İK AI asistanı</h1>
          <p className="bz-page-header__sub max-w-3xl">
            Personel değerlendirme sonuçlarına dayalı terfi ve rol önerileri için
            sorularınızı yazın. Belirli bir bölüm adı geçirdiğinizde liste o
            departmana göre daraltılır.
          </p>
        </div>
      </div>

      <AiChatWorkArea className="min-h-0 flex-1" />
    </div>
  );
}
