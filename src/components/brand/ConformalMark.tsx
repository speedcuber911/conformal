type ConformalMarkProps = {
  className?: string;
  size?: number;
};

export function ConformalMark({ className, size = 20 }: ConformalMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 28 28"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0.5" y="0.5" width="27" height="27" rx="7" fill="#0E0E0E" />
      <rect x="0.5" y="0.5" width="27" height="27" rx="7" stroke="rgba(255,255,255,0.18)" />
      <path
        d="M18.95 7.5C17.62 6.54 15.94 5.98 14.08 5.98C9.57 5.98 5.9 9.57 5.9 14C5.9 18.43 9.57 22.02 14.08 22.02C15.94 22.02 17.62 21.46 18.95 20.5"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeWidth="2.35"
      />
      <path
        d="M14.3 10.45H20.2L17.45 14L20.2 17.55H14.3"
        stroke="#B8232E"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.25"
      />
      <circle cx="13.92" cy="14" r="1.45" fill="#FFFFFF" />
    </svg>
  );
}
