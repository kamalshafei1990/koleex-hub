/* Public event invitation — /invite/<token>. No sign-in: the token IS the
   guest's credential. Page metadata is generic on purpose (the invite
   payload is personal; nothing of it belongs in the HTML head). */

import type { Metadata } from "next";
import InvitePage from "@/components/invite/InvitePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitation — KOLEEX",
  robots: { index: false, follow: false },
};

export default async function InviteRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitePage token={token} />;
}
