/* Notes app icon — a filled sheet of paper with three knocked-out text
   lines (the third shorter, like a trailing thought). Same silhouette as
   before, redrawn in the set's filled grammar: 24-grid, currentColor, solid
   shape with even-odd knock-outs — so its visual weight matches the other
   launcher icons instead of reading thinner beside them. */

export default function NotesIcon({
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
        d="M7 3h10a2.5 2.5 0 0 1 2.5 2.5v13A2.5 2.5 0 0 1 17 21H7a2.5 2.5 0 0 1-2.5-2.5v-13A2.5 2.5 0 0 1 7 3Zm1 4.2h8a.8.8 0 0 1 0 1.6H8a.8.8 0 0 1 0-1.6Zm0 4h8a.8.8 0 0 1 0 1.6H8a.8.8 0 0 1 0-1.6Zm0 4h5a.8.8 0 0 1 0 1.6H8a.8.8 0 0 1 0-1.6Z"
      />
    </svg>
  );
}
