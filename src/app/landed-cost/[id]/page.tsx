"use client";

import { useParams } from "next/navigation";
import SimulationForm from "@/components/landed-cost/SimulationForm";

export default function EditSimulationPage() {
  const { id } = useParams<{ id: string }>();
  return <SimulationForm id={id} />;
}
