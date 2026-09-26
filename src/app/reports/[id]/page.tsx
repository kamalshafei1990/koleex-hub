import ReportView from "@/components/reports/app/ReportView";

/* Keyed by id: opening a new version from the reader lands on a fresh
   screen, never the previous report's state for a frame. */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportView key={id} id={id} />;
}
