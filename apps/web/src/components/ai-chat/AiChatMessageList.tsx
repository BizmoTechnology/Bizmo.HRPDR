"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export interface ChatMsg {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
}

const assistantMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="mb-2 mt-4 border-b border-border/50 pb-1.5 text-base font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h4 className="mb-2 mt-3 text-[0.9375rem] font-semibold text-foreground first:mt-0">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h5 className="mb-1.5 mt-2 text-[0.875rem] font-semibold text-foreground first:mt-0">
      {children}
    </h5>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-[13px] leading-relaxed text-foreground/95 last:mb-0 sm:text-sm">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 space-y-1.5 pl-4 [list-style-type:disc] marker:text-brand-ink">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1.5 pl-4 marker:font-medium marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed [&>p]:mb-1 [&>p]:last:mb-0">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/90">{children}</em>
  ),
  hr: () => <hr className="my-4 border-border/40" />,
  blockquote: ({ children }) => (
    <blockquote className="my-3 rounded-r-md border-l-2 border-primary/45 bg-muted/35 py-2 pl-3 pr-2 text-[13px] leading-relaxed text-muted-foreground [&>p]:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const fenced = Boolean(className?.startsWith("language-"));
    if (fenced) {
      return (
        <code
          className={cn(
            "block whitespace-pre font-mono text-[11px] leading-relaxed text-foreground sm:text-xs",
            className,
          )}
        >
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] text-foreground sm:text-xs">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl border border-border/45 bg-muted/45 p-3 text-xs shadow-inner [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border/40 bg-muted/10">
      <table className="w-full min-w-[260px] border-collapse text-left text-[12px] sm:text-[13px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/55 text-foreground">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border/35">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="transition-colors hover:bg-muted/30">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="border-b border-border/50 px-2.5 py-2 font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-border/25 px-2.5 py-2 align-top text-muted-foreground">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand-ink underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
};

export function AiChatMessageList({
  messages,
  className,
}: {
  messages: ChatMsg[];
  className?: string;
}) {
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-4", className)}>
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            // Bizmo ileti balonu (DESIGN.md §22): gelen yüzey + cam kenar, giden yeşil yumuşak; gönderen tarafında 6px "kuyruk"
            "w-fit min-w-0 max-w-[min(85%,36rem)] rounded-2xl px-3.5 py-3 text-sm leading-relaxed sm:px-4 sm:py-3.5",
            m.role === "user"
              ? "ml-auto rounded-br-sm bg-brand-soft text-foreground"
              : "mr-auto w-full rounded-bl-sm border border-glass-border bg-card text-foreground shadow-1",
          )}
        >
          {m.role === "assistant" ? (
            <div className="min-w-0">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={assistantMarkdownComponents}
              >
                {m.content}
              </Markdown>
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words text-[13px] sm:text-sm">
              {m.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
