import { GlassSidebar } from "@/components/layout/GlassSidebar";
import { GlassTopbar } from "@/components/layout/GlassTopbar";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { AiChatDock } from "@/components/ai-chat/AiChatDock";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      {/* print: rapor yazdırılırken yalnızca sayfa içeriği basılır */}
      <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">
        <div className="contents print:hidden">
          <GlassSidebar />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="contents print:hidden">
            <GlassTopbar />
          </div>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 lg:pb-8 print:overflow-visible print:p-0">
            {children}
          </main>
        </div>
        <div className="contents print:hidden">
          <AiChatDock />
        </div>
      </div>
    </AuthGuard>
  );
}
