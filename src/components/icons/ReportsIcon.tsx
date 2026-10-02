/* Reports app icon — a filled sheet with a folded corner (knocked-out
   diagonal), two knocked-out text lines for the written report, and three
   rising bar slots for the number report: both report kinds under one roof.
   Redrawn in the set's filled grammar (24-grid, currentColor, even-odd
   knock-outs) so its weight matches the neighbouring launcher icons. */

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
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7 2.5h7l5.5 5.5v10.5a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5V5A2.5 2.5 0 0 1 7 2.5Zm6.3-.6h1.3l6.2 6.2v1.3h-1.3l-6.2-6.2V1.9ZM8 9.9h5.2a.8.8 0 0 1 0 1.6H8a.8.8 0 0 1 0-1.6Zm0 3h3.2a.8.8 0 0 1 0 1.6H8a.8.8 0 0 1 0-1.6Zm0 4.3h1.5V19H8v-1.8Zm2.7-1h1.5V19h-1.5v-2.8Zm2.7-1h1.5V19h-1.5v-3.8Z"
      />
    </svg>
  );
}
