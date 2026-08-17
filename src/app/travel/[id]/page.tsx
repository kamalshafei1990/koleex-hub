"use client";

import { use } from "react";
import InvitationForm from "@/components/travel/InvitationForm";

export default function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <InvitationForm id={id} />;
}
