import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-brand-ink" />
        <p className="text-sm">Yükleniyor…</p>
      </div>
    </div>
  );
}
