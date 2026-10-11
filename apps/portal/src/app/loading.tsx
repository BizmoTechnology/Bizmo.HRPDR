import { Loader2 } from "lucide-react";

export default function PortalLoading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-brand-ink" />
        <p className="text-sm">Yükleniyor…</p>
      </div>
    </div>
  );
}
