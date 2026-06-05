import ReporterIssueView from "@/components/qa/ReporterIssueView";

/* Reporter-safe, read-only view of a single QA issue. Any authenticated user
   can reach it; the API enforces that they're the reporter (or an admin
   previewing). Distinct from the admin console at /database/issues. */
export default async function ReporterIssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReporterIssueView issueId={id} />;
}
