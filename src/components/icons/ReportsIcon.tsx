/* Reports app icon — a sheet with a folded corner, two lines of text and a
   small rising chart: the written report and the number report under one
   roof. Same outline grammar as NotesIcon and TodoIcon. */

export default function ReportsIcon({
  size = 24,
  className,
}: {
  size?: number | string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14 3H7a2.5 2.5 0 0 0-2.5 2.5v13A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5V8.5z" />
      <path d="M14 3v4a1.5 1.5 0 0 0 1.5 1.5h4" />
      <line x1="8" y1="11.5" x2="13" y2="11.5" />
      <line x1="8" y1="14.5" x2="11" y2="14.5" />
      <path d="M13 18l2-2.2 1.6 1.2L19 14" />
    </svg>
  );
}
