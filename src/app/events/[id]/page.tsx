"use client";

import { use } from "react";
import EventWorkspace from "@/components/events/EventWorkspace";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <EventWorkspace id={id} />;
}
