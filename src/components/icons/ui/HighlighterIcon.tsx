export default function HighlighterIcon({
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
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 11L3 17v4h4l6-6" />
      <path d="M14 6l4 4" />
      <path d="M22 2l-9 9-4-4 9-9z" />
    </svg>
  );
}
