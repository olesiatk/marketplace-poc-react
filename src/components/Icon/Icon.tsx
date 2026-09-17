export type IconName =
  | "sofa" | "table" | "chair" | "storage" | "bed" | "decor"
  | "mic" | "search" | "close" | "info" | "star" | "chevron-down";

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

/** Returns the raw <svg> directly (no wrapper element) so it lays out inline like any other icon font would. */
export function Icon({ name, size = 24, className }: IconProps) {
  switch (name) {
    case "sofa":
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <rect x="12" y="14" width="40" height="10" rx="3" />
          <rect x="8" y="24" width="10" height="18" rx="3" />
          <rect x="46" y="24" width="10" height="18" rx="3" />
          <rect x="18" y="30" width="28" height="12" rx="3" />
          <path d="M12 48v6M20 48v6M44 48v6M52 48v6" />
        </svg>
      );
    case "table":
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <rect x="8" y="20" width="48" height="7" rx="2" />
          <path d="M14 27v18M50 27v18M22 27l-4 18M42 27l4 18" />
        </svg>
      );
    case "chair":
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <path d="M18 10h28l-3 26H21L18 10Z" />
          <path d="M16 36h32l4 8H12l4-8Z" />
          <path d="M16 44l-3 12M48 44l3 12M24 44v12M40 44v12" />
        </svg>
      );
    case "storage":
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <rect x="10" y="8" width="44" height="48" rx="2" />
          <path d="M10 24h44M10 40h44" />
          <circle cx="30" cy="16" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="30" cy="32" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="30" cy="48" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "bed":
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <path d="M8 46V20a2 2 0 0 1 2-2h10v14" />
          <path d="M8 34h48v12" />
          <path d="M8 52v-6M56 52v-6" />
          <rect x="14" y="24" width="14" height="8" rx="2" />
          <path d="M32 32h20a4 4 0 0 1 4 4v4H32v-8Z" />
        </svg>
      );
    case "decor":
      return (
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <path d="M32 8a16 16 0 0 1 9 29c-2 1.5-3 3.5-3 6H26c0-2.5-1-4.5-3-6A16 16 0 0 1 32 8Z" />
          <path d="M32 20v14M27 50h10M28 56h8" />
        </svg>
      );
    case "mic":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "close":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "info":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width={size} height={size} className={className}>
          <path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6 5.9 21l1.5-6.8-5.2-4.7 6.9-.7L12 2.5Z" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size} className={className}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
  }
}
