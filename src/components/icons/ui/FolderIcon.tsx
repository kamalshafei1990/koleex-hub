/* Clean folder icon for the Notes app sidebar. Simple closed folder. */
export default function FolderIcon({
  size = 16,
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
    >
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.3a1.5 1.5 0 0 1 1.06.44l1.4 1.4A1.5 1.5 0 0 0 12.32 8.3H19.5A1.5 1.5 0 0 1 21 9.8v7.7A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z" />
    </svg>
  );
}
