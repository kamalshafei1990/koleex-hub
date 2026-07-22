import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* Translator is a utility every signed-in employee needs (supplier chats,
   customer emails, spec sheets), so it sits behind the login gate only —
   no module permission, same as a system-wide tool. Client-only because the
   whole app is browser state (Web Speech, localStorage history). */
const TranslatorApp = dynamic(() => import("@/components/translator/TranslatorApp"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
      <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
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
