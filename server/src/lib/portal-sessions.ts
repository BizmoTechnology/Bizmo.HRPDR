/**
 * Portalda şu anda erişilebilen oturum koşulu: aktif değerlendirmede yarım kalan
 * oturum ya da süresi içinde, henüz başlamamış atama. Portal oturum uç noktaları,
 * SMS ile giriş uygunluğu ve İK panelindeki SMS durumu aynı koşulu kullanır.
 */
export function portalAccessibleSessionWhere(now: Date) {
  return {
    personnel: { deletedAt: null },
    assessment: { status: "ACTIVE" as const },
    OR: [
      { status: "IN_PROGRESS" as const },
      {
        status: "NOT_STARTED" as const,
        AND: [
          { OR: [{ dueAt: null }, { dueAt: { gte: now } }] },
          { assessment: { OR: [{ startsAt: null }, { startsAt: { lte: now } }] } },
          { assessment: { OR: [{ endsAt: null }, { endsAt: { gte: now } }] } },
        ],
      },
    ],
  };
}

/** Personelin şu anda erişebileceği oturum koşulu */
export function portalSessionWhere(personnelId: string, now: Date) {
  return { personnelId, ...portalAccessibleSessionWhere(now) };
}
