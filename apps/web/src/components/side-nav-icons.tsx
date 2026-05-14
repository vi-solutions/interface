// components/side-nav-icons.tsx

type IconProps = {
  className?: string;
};

const strokeProps = {
  stroke: "currentColor",
  strokeWidth: 1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconSvg({
  className,
  viewBox = "0 0 24 24",
  children,
}: IconProps & {
  viewBox?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <path d="M4 11.5L12 4L20 11.5" {...strokeProps} />
      <path d="M6 10.8V20H10.5V15H13.5V20H18V10.8" {...strokeProps} />
      <circle cx="12" cy="10.5" r="2" {...strokeProps} />
    </IconSvg>
  );
}

export function FolderIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <path
        d="M3 7.5C3 6.67 3.67 6 4.5 6H9L11 8H19.5C20.33 8 21 8.67 21 9.5V18C21 18.83 20.33 19.5 19.5 19.5H4.5C3.67 19.5 3 18.83 3 18V7.5Z"
        {...strokeProps}
      />
    </IconSvg>
  );
}

export function ContactIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <rect x="7" y="3" width="13" height="18" rx="2" {...strokeProps} />
      <path d="M7 6H4M7 10H4M7 14H4M7 18H4" {...strokeProps} />
      <circle cx="13.5" cy="10" r="2.3" {...strokeProps} />
      <path
        d="M10 17C10.4 14.8 11.8 13.5 13.5 13.5C15.2 13.5 16.6 14.8 17 17"
        {...strokeProps}
      />
    </IconSvg>
  );
}

export function DocumentLeafIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <path d="M6 3H14L18 7V21H6V3Z" {...strokeProps} />
      <path d="M14 3V7H18" {...strokeProps} />
      <path d="M9 10H14M9 13H13M9 16H12" {...strokeProps} />
      <path
        d="M13.5 21C17 21 19.5 18.5 19.5 15C16 15 13.5 17.5 13.5 21Z"
        {...strokeProps}
      />
      <path d="M13.5 21L18 16.5" {...strokeProps} />
    </IconSvg>
  );
}

export function ClockLeafIcon({ className }: IconProps) {
  return (
    <IconSvg className={className} viewBox="-3 -3 30 30">
      <path d="M12 4.5V3" {...strokeProps} />
      <path d="M9.8 3H14.2" {...strokeProps} />
      <path d="M18.5 6L20 4.5" {...strokeProps} />
      <path d="M20.5 6.5L19 5" {...strokeProps} />
      <path d="M12 7.5V12L14.5 14.5" {...strokeProps} />
      <path d="M4.5 12H6" {...strokeProps} />
      <path d="M12 20.5V19" {...strokeProps} />
      <path
        d="M5.5 17.5C4.25 16 3.5 14.1 3.5 12C3.5 7.3 7.3 3.5 12 3.5C16.1 3.5 19.5 6.4 20.3 10.25"
        {...strokeProps}
      />
      <path
        d="M14.5 21C18 21 20.5 18.5 20.5 15C17 15 14.5 17.5 14.5 21Z"
        {...strokeProps}
      />
      <path d="M14.5 21L19 16.5" {...strokeProps} />
    </IconSvg>
  );
}

export function ReceiptIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <path
        d="M6 3L8 5L10 3L12 5L14 3L16 5L18 3V21L16 19L14 21L12 19L10 21L8 19L6 21V3Z"
        {...strokeProps}
      />
      <path d="M12 7V17" {...strokeProps} />
      <path
        d="M14.5 9.5C13.8 8.9 12.9 8.6 12 8.6C10.7 8.6 9.7 9.3 9.7 10.4C9.7 12.7 14.3 11.7 14.3 14.4C14.3 15.5 13.3 16.4 12 16.4C11 16.4 10.1 16.1 9.4 15.4"
        {...strokeProps}
      />
    </IconSvg>
  );
}

export function NetworkIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <circle cx="6" cy="13" r="2.5" {...strokeProps} />
      <circle cx="13" cy="11" r="2.8" {...strokeProps} />
      <circle cx="18.5" cy="5.5" r="2.5" {...strokeProps} />
      <circle cx="18.5" cy="18.5" r="2.5" {...strokeProps} />
      <path d="M8.4 12.3L10.4 11.7" {...strokeProps} />
      <path d="M15 9L16.8 7.2" {...strokeProps} />
      <path d="M15 13L16.8 16.3" {...strokeProps} />
    </IconSvg>
  );
}

export function IdBadgeIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <path
        d="M9.5 5.5V4.5C9.5 3.7 10.2 3 11 3H13C13.8 3 14.5 3.7 14.5 4.5V5.5"
        {...strokeProps}
      />
      <path d="M8.5 5.5H15.5" {...strokeProps} />
      <rect x="4" y="6" width="16" height="14" rx="2" {...strokeProps} />
      <circle cx="9" cy="11.5" r="2" {...strokeProps} />
      <path
        d="M6.5 17C6.9 15.2 7.9 14.2 9 14.2C10.1 14.2 11.1 15.2 11.5 17"
        {...strokeProps}
      />
      <path d="M14 11H17.5" {...strokeProps} />
      <path d="M14 14H17.5" {...strokeProps} />
      <path d="M14 17H16.5" {...strokeProps} />
    </IconSvg>
  );
}

export function InvoiceIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <path d="M6 3H14L18 7V21H6V3Z" {...strokeProps} />
      <path d="M14 3V7H18" {...strokeProps} />
      <path d="M9 11H13.5" {...strokeProps} />
      <path d="M9 14H13" {...strokeProps} />
      <path d="M9 17H12" {...strokeProps} />
      <path
        d="M18.5 10.5C17.8 9.9 16.9 9.6 16 9.6C14.7 9.6 13.7 10.3 13.7 11.4C13.7 13.7 18.3 12.7 18.3 15.4C18.3 16.5 17.3 17.4 16 17.4C15 17.4 14.1 17.1 13.4 16.4"
        {...strokeProps}
      />
      <path d="M16 8.5V18.5" {...strokeProps} />
    </IconSvg>
  );
}

export function PhoneLocationIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2" {...strokeProps} />
      <path d="M10.5 5H13.5" {...strokeProps} />
      <circle cx="12" cy="18.8" r="0.8" {...strokeProps} />
      <path
        d="M12 14.5C12 14.5 15.5 11.2 15.5 8.5C15.5 6.6 13.9 5 12 5C10.1 5 8.5 6.6 8.5 8.5C8.5 11.2 12 14.5 12 14.5Z"
        {...strokeProps}
      />
      <circle cx="12" cy="8.5" r="1.1" {...strokeProps} />
    </IconSvg>
  );
}

export function GroupIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <circle cx="12" cy="7" r="3" {...strokeProps} />
      <path
        d="M6.5 20C7.1 16.5 9.1 14.5 12 14.5C14.9 14.5 16.9 16.5 17.5 20H6.5Z"
        {...strokeProps}
      />
      <circle cx="5.5" cy="10" r="2" {...strokeProps} />
      <path d="M2.5 18C2.8 15.7 4 14.4 6 14.2" {...strokeProps} />
      <circle cx="18.5" cy="10" r="2" {...strokeProps} />
      <path d="M21.5 18C21.2 15.7 20 14.4 18 14.2" {...strokeProps} />
    </IconSvg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <circle cx="12" cy="8" r="3" {...strokeProps} />
      <path
        d="M6 20C6.7 16.5 8.8 14.5 12 14.5C15.2 14.5 17.3 16.5 18 20"
        {...strokeProps}
      />
    </IconSvg>
  );
}

export function ArrowOutIcon({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <path
        d="M9 7V5.5C9 4.7 9.7 4 10.5 4H18.5C19.3 4 20 4.7 20 5.5V18.5C20 19.3 19.3 20 18.5 20H10.5C9.7 20 9 19.3 9 18.5V17"
        {...strokeProps}
      />
      <path d="M13 12H3.5" {...strokeProps} />
      <path d="M6.5 9L3.5 12L6.5 15" {...strokeProps} />
    </IconSvg>
  );
}
