"use client";

import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiChatInput({
  onSend,
  disabled,
  placeholder = "Sorunuzu yazın…",
}: {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const t = value.trim();
    if (!t || disabled) return;
    setValue("");
    await onSend(t);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div
      className={cn(
        // Yazma alanı (DESIGN.md §22): yumuşak köşeli kutu, odakta yeşil halka
        "flex items-end gap-2 rounded-3xl border border-input bg-field p-1.5 pl-3 transition-[border-color,box-shadow] focus-within:border-ring focus-within:bg-card focus-within:shadow-[0_0_0_3px_var(--bz-accent-soft)]",
      )}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="max-h-[140px] min-h-[2.75rem] flex-1 resize-none bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={disabled || !value.trim()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-brand-strong disabled:opacity-40"
        aria-label="Gönder"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
