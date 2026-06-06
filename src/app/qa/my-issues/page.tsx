import MyIssuesView from "@/components/qa/MyIssuesView";

/* Reporter-facing list of the caller's own filed issues (issue e3bc4002).
   The API (/api/qa/my-issues) scopes results to reporter_id = caller, so any
   authenticated user sees only their own reports. From here they open an
   issue and can edit it while it's still pre-work. */
export default function MyIssuesPage() {
  return <MyIssuesView />;
}
