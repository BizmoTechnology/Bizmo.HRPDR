"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import {
  useAiChatConversation,
  useAiChatConversations,
  useCreateAiChatConversation,
  useDeleteAiChatConversation,
  useSendAiChatMessage,
  useAiStatus,
} from "@/hooks/use-api";
import { AiNotConnectedNotice } from "@/components/ai/AiNotConnectedNotice";
import { AiChatMessageList } from "./AiChatMessageList";
import { AiChatInput } from "./AiChatInput";
import { cn } from "@/lib/utils";

function AiChatOuter({
  embedded,
  className,
  children,
}: {
  embedded: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (embedded) {
    return <div className={className}>{children}</div>;
  }
  return <GlassCard className={cn("p-0", className)}>{children}</GlassCard>;
}

export function AiChatWorkArea({
  embedded = false,
  showHeading = true,
  className,
}: {
  embedded?: boolean;
  /** Sayfa kendi başlığını gösteriyorsa (ör. /ai-chat) başlık tekrarlanmaz; yalnız eylemler kalır */
  showHeading?: boolean;
  className?: string;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  /** Sohbet listesi (mobil şerit + masaüstü kenar çubuğu) */
  const [conversationListOpen, setConversationListOpen] = useState(true);

  const { data: list } = useAiChatConversations();
  const { data: detail, isLoading: loadingDetail } =
    useAiChatConversation(conversationId);
  const createConv = useCreateAiChatConversation();
  const sendMsg = useSendAiChatMessage();
  const deleteConv = useDeleteAiChatConversation();
  const { data: aiStatus } = useAiStatus();
  const aiConnected = aiStatus?.connected !== false;

  const messages = useMemo(
    () =>
      (detail?.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    [detail?.messages],
  );

  const busy =
    createConv.isPending || sendMsg.isPending || deleteConv.isPending;

  const handleSend = async (text: string) => {
    try {
      let id = conversationId;
      if (!id) {
        const c = await createConv.mutateAsync({});
        id = c.id;
        setConversationId(id);
      }
      await sendMsg.mutateAsync({ conversationId: id, content: text });
    } catch (e) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      toast.error(msg ?? "Mesaj gönderilemedi");
    }
  };

  const newChat = () => setConversationId(null);

  const removeChat = async () => {
    if (!conversationId) return;
    try {
      await deleteConv.mutateAsync(conversationId);
      setConversationId(null);
      toast.success("Sohbet silindi");
    } catch {
      toast.error("Sohbet silinemedi");
    }
  };

  const conversations = list ?? [];

  return (
    <AiChatOuter
      embedded={embedded}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        embedded ? "h-full bg-transparent" : "",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-start justify-between gap-2 border-b border-divider px-3 sm:px-4",
          showHeading ? "pb-2 pt-4 sm:pb-3 sm:pt-5" : "py-2",
          // Çekmecede sağ üst köşe Kapat düğmesine ayrılır
          embedded ? "pr-16 sm:pr-16 pl-5 sm:pl-6" : "rounded-t-2xl",
        )}
      >
        <div className="min-w-0 flex-1">
          {showHeading ? (
            <>
              <h2 className="text-base font-bold leading-tight text-foreground">
                İK AI Asistanı
              </h2>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                Terfi, amirlik ve aday önerileri — kurum değerlendirme verilerine dayanır
              </p>
            </>
          ) : (
            <p className="truncate pt-1.5 text-sm font-semibold text-foreground">
              {conversationId ? detail?.title?.trim() || "Sohbet" : "Yeni sohbet"}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            onClick={newChat}
            className="bz-icon-btn"
            title="Yeni sohbet"
            aria-label="Yeni sohbet"
          >
            <MessageSquarePlus />
          </button>
          {conversationId ? (
            <button
              type="button"
              onClick={() => void removeChat()}
              disabled={busy}
              className="bz-icon-btn hover:bg-danger-soft hover:text-danger-ink"
              title="Sohbeti sil"
              aria-label="Sohbeti sil"
            >
              <Trash2 />
            </button>
          ) : null}
        </div>
      </div>

      {/* Mobil: sol — liste daralt; sağ — sohbet çipleri (daralt kontrolü şeritte) */}
      <div id="ai-chat-conv-mobile" className="shrink-0 border-b border-border/40 md:hidden">
        <div className="flex items-stretch gap-1.5 px-2 py-2">
          <button
            type="button"
            onClick={() => setConversationListOpen((v) => !v)}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30 p-2 text-muted-foreground hover:bg-muted hover:text-foreground",
              conversationListOpen && "border-primary/30 bg-primary/10 text-foreground",
            )}
            title={
              conversationListOpen
                ? "Sohbet listesini gizle"
                : "Sohbet listesini göster"
            }
            aria-expanded={conversationListOpen}
            aria-controls="ai-chat-conv-mobile-chips"
          >
            {conversationListOpen ? (
              <PanelLeftClose className="h-5 w-5" aria-hidden />
            ) : (
              <PanelLeftOpen className="h-5 w-5" aria-hidden />
            )}
          </button>
          {conversationListOpen ? (
            <div
              id="ai-chat-conv-mobile-chips"
              className="scrollbar-none min-w-0 flex-1 overflow-x-auto"
            >
              <div className="flex min-w-min gap-1.5 py-0.5">
                {conversations.length === 0 ? (
                  <span className="flex items-center px-1 text-[11px] text-muted-foreground">
                    Sohbet yok — alttan yazarak başlayın
                  </span>
                ) : (
                  conversations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setConversationId(c.id)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1.5 text-left text-[11px] transition",
                        conversationId === c.id
                          ? "border-primary bg-primary/15 font-medium text-foreground"
                          : "border-border/60 bg-muted/50 hover:bg-muted",
                      )}
                    >
                      {(c.title?.trim() || "Sohbet").slice(0, 28)}
                      {(c.title?.length ?? 0) > 28 ? "…" : ""}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          className={cn(
            "hidden shrink-0 flex-col border-r border-border/40 bg-muted/15 md:flex",
            conversationListOpen ? "w-[11.5rem]" : "w-11",
          )}
        >
          {conversationListOpen ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-1 border-b border-border/35 px-2 py-2">
                <span className="bz-kicker min-w-0 flex-1 truncate">
                  Sohbetler
                </span>
                <button
                  type="button"
                  onClick={() => setConversationListOpen(false)}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Sohbet listesini gizle"
                  aria-expanded="true"
                  aria-controls="ai-chat-conv-desktop-list"
                >
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <aside
                id="ai-chat-conv-desktop"
                className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-2 pt-1"
              >
                <div
                  id="ai-chat-conv-desktop-list"
                  className="flex min-h-0 flex-1 flex-col gap-0.5"
                >
                  {conversations.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      Henüz yok
                    </p>
                  ) : (
                    conversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setConversationId(c.id)}
                        className={cn(
                          "truncate rounded-lg px-2 py-2 text-left text-xs transition",
                          conversationId === c.id
                            ? "bg-primary/15 font-medium text-foreground"
                            : "hover:bg-muted/80",
                        )}
                      >
                        {c.title?.trim() || "Yeni sohbet"}
                      </button>
                    ))
                  )}
                </div>
              </aside>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-3">
              <button
                type="button"
                onClick={() => setConversationListOpen(true)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Sohbet listesini göster"
                aria-expanded="false"
                aria-controls="ai-chat-conv-desktop-list"
              >
                <PanelLeftOpen className="h-5 w-5" aria-hidden />
              </button>
            </div>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2 sm:px-4">
            {loadingDetail && conversationId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Yükleniyor…</span>
              </div>
            ) : (
              <>
                <div className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
                  {!aiConnected && (
                    <AiNotConnectedNotice feature="AI asistan" className="mb-3" />
                  )}
                  {!conversationId && messages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-center">
                      <p className="mb-2 text-sm font-medium text-foreground">
                        Örnek sorular
                      </p>
                      <ul className="space-y-2 text-left text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                        <li>
                          • &quot;Üretimde vardiya amiri açığı var, kimi önerirsin?&quot;
                        </li>
                        <li>
                          • &quot;Liderlik skoru yüksek ve terfiye hazır kimler?&quot;
                        </li>
                      </ul>
                    </div>
                  ) : (
                    <AiChatMessageList messages={messages} />
                  )}
                  {sendMsg.isPending ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Yanıt yazılıyor…
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-border/30 pt-2">
                  <AiChatInput
                    onSend={handleSend}
                    disabled={busy || !aiConnected}
                    placeholder={aiConnected ? "Sorunuzu yazın…" : "AI entegrasyonu bağlı değil"}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AiChatOuter>
  );
}
