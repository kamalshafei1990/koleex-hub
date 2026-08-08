import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import BrandLoading from "@/components/ui/BrandLoading";

/* Translator is a utility every signed-in employee needs (supplier chats,
   customer emails, spec sheets), so it sits behind the login gate only —
   no module permission, same as a system-wide tool. Client-only because the
   whole app is browser state (Web Speech, localStorage history). */
const TranslatorApp = dynamic(() => import("@/components/translator/TranslatorApp"), {
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <BrandLoading className="min-h-screen" />
    </div>
  ),
});

export default function TranslatorPage() {
  return (
    <AdminAuth title="Translator" subtitle="Sign in to use the translator">
      <TranslatorApp />
    </AdminAuth>
  );
}
