/**
 * Admin Command Center icon system.
 *
 * Dependency-free inline SVG. Every icon is drawn on the same 24x24 grid with
 * a 1.75 stroke so the set reads as one family.
 *
 * Each admin function has its own semantically correct glyph — orders is a
 * package, inventory is a warehouse, pricing is a tag, import is an upload,
 * sync is a sync, and so on. Icons are never reused across meanings, and no
 * emoji are used anywhere in the admin surface.
 *
 * Every icon is decorative: each one sits beside a text label, so all are
 * hidden from assistive technology.
 */

export type IconProps = {
  className?: string;
  style?: React.CSSProperties;
};

function Svg({
  className = "h-5 w-5",
  style,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ identity */

export const IconCommand = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.75" />
    <rect x="13.5" y="3" width="7.5" height="4.5" rx="1.75" />
    <rect x="13.5" y="10.5" width="7.5" height="10.5" rx="1.75" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.75" />
  </Svg>
);

export const IconGauge = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 17a8 8 0 1 1 16 0" />
    <path d="m12 13 3.5-3.5" />
    <circle cx="12" cy="17" r="1.4" />
  </Svg>
);

/* ------------------------------------------------------------- core operations */

export const IconPackage = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 7.8 12 3.2 3.5 7.8v8.4L12 20.8l8.5-4.6Z" />
    <path d="M3.7 7.9 12 12.4l8.3-4.5" />
    <path d="M12 12.4v8.4" />
    <path d="M7.8 5.4 16.3 9.9" />
  </Svg>
);

export const IconBoxes = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="12.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="12.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="8.25" y="3.5" width="7.5" height="7.5" rx="1.6" />
  </Svg>
);

export const IconStack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 21 7.5 12 12 3 7.5Z" />
    <path d="m3 12 9 4.5L21 12" />
    <path d="m3 16.5 9 4.5 9-4.5" />
  </Svg>
);

export const IconWarehouse = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.75 9.5 12 4.5l9.25 5" />
    <path d="M4.75 9.5V20h14.5V9.5" />
    <rect x="9.5" y="13" width="5" height="7" rx="1" />
    <path d="M9.5 10.5h5" />
  </Svg>
);

export const IconStock = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8.5 12 4l9 4.5" />
    <path d="M3 8.5V16l9 4.5 9-4.5V8.5" />
    <path d="M12 12.2 21 7.7M3 16l9-4.3" />
  </Svg>
);

export const IconInventory = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="4.5" rx="1.4" />
    <rect x="3" y="10" width="18" height="4.5" rx="1.4" />
    <rect x="3" y="16" width="18" height="4.5" rx="1.4" />
    <path d="M6.75 6.25h.01M6.75 12.25h.01M6.75 18.25h.01" />
  </Svg>
);

export const IconUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9.5" cy="8" r="3.4" />
    <path d="M3 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6" />
    <path d="M18 14.4A6.5 6.5 0 0 1 21 20" />
  </Svg>
);

export const IconClipboard = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 4.5h7a1 1 0 0 1 1 1v1H7.5v-1a1 1 0 0 1 1-1Z" />
    <path d="M16.5 6.5h1.75A1.75 1.75 0 0 1 20 8.25V19a1.75 1.75 0 0 1-1.75 1.75h-12.5A1.75 1.75 0 0 1 4 19V8.25A1.75 1.75 0 0 1 5.75 6.5H7.5" />
    <path d="M8.5 11.5h7M8.5 15h4.5" />
  </Svg>
);

export const IconList = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
  </Svg>
);

/* -------------------------------------------------------------------- finance */

export const IconCard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.75" y="5" width="18.5" height="14" rx="2.4" />
    <path d="M2.75 9.75h18.5" />
    <path d="M6.5 14.5h3.5" />
  </Svg>
);

export const IconRupee = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 4.5h9" />
    <path d="M7.5 8.5h9" />
    <path d="M13 12.2c0 3.3-2.3 5.3-5.5 5.3l8 3.5" />
    <path d="M10.5 12.2h6" />
  </Svg>
);

export const IconChart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 3.5v17h17" />
    <path d="M7.5 16.5v-4M12 16.5v-8M16.5 16.5v-6" />
  </Svg>
);

export const IconPriceTag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11.2 3.5H20V12l-8.6 8.6a1.5 1.5 0 0 1-2.1 0l-5.9-5.9a1.5 1.5 0 0 1 0-2.1Z" />
    <circle cx="16" cy="8" r="1.4" />
  </Svg>
);

export const IconWallet = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h11a2 2 0 0 1 2 2v1" />
    <rect x="3.5" y="8.5" width="17" height="10.5" rx="2" />
    <circle cx="16" cy="13.75" r="1.2" />
  </Svg>
);

export const IconInvoice = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 3.5h9l4 4v13h-13Z" />
    <path d="M14.5 3.5v4h4" />
    <path d="M8.5 12.5h7M8.5 16h4" />
  </Svg>
);

export const IconQuote = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 3.5h9l4 4v13h-13Z" />
    <path d="M14.5 3.5v4h4" />
    <path d="M9 11.5c-1.1 0-1.9.8-1.9 1.9 0 1 .8 1.8 1.8 1.8" />
    <path d="M15 11.5c-1.1 0-1.9.8-1.9 1.9 0 1 .8 1.8 1.8 1.8" />
  </Svg>
);

/* -------------------------------------------------------------------- business */

export const IconDealership = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 20.5h18" />
    <path d="M5 20.5V8.5L12 4l7 4.5v12" />
    <path d="M9.5 20.5v-5.5h5v5.5" />
    <path d="M5 11.5h14" />
  </Svg>
);

export const IconBusiness = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
    <path d="M8 7.5h2M14 7.5h2M8 11.5h2M14 11.5h2M8 15.5h2M14 15.5h2" />
    <path d="M2.5 20.5h19" />
  </Svg>
);

export const IconSupplier = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8h11v8H3zM14 11h4l3 3v2h-7z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </Svg>
);

/* ------------------------------------------------------------------- logistics */

export const IconTruck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.75 6.5h10.5v10h-10.5z" />
    <path d="M13.25 10h3.6l2.4 3.1v3.4h-6z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="16.5" cy="18" r="1.8" />
  </Svg>
);

export const IconReceipt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 3.5h13v17l-2.2-1.4-2.2 1.4-2.1-1.4-2.2 1.4-2.3-1.4Z" />
    <path d="M9 8.5h6M9 12.5h6" />
  </Svg>
);

export const IconCart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.75 4.5h2.6l2.2 10.2a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.2l1.6-6.3H6.1" />
    <circle cx="9.5" cy="20" r="1.3" />
    <circle cx="17.5" cy="20" r="1.3" />
  </Svg>
);

export const IconTransfer = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8.5h13" />
    <path d="m14 5 3 3.5-3 3.5" />
    <path d="M20 15.5H7" />
    <path d="m10 12-3 3.5 3 3.5" />
  </Svg>
);

export const IconSliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7.5h10M18 7.5h2M4 16.5h4M12 16.5h8" />
    <circle cx="16" cy="7.5" r="2.2" />
    <circle cx="10" cy="16.5" r="2.2" />
  </Svg>
);

/* ------------------------------------------------------------------- catalogue */

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 15.5v3.25A1.75 1.75 0 0 0 5.75 20.5h12.5A1.75 1.75 0 0 0 20 18.75V15.5" />
    <path d="M12 15.5V3.5" />
    <path d="m7.5 8 4.5-4.5L16.5 8" />
  </Svg>
);

export const IconDatabase = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="6" rx="7.5" ry="3" />
    <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
    <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
  </Svg>
);

export const IconSync = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 7.5A8.5 8.5 0 0 0 5.6 6.3L3.5 8.5" />
    <path d="M3.5 4v4.5H8" />
    <path d="M4 16.5a8.5 8.5 0 0 0 14.4 1.2l2.1-2.2" />
    <path d="M20.5 20v-4.5H16" />
  </Svg>
);

export const IconGrid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.25" y="3.25" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.25" y="3.25" width="7.5" height="7.5" rx="1.6" />
    <rect x="3.25" y="13.25" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.25" y="13.25" width="7.5" height="7.5" rx="1.6" />
  </Svg>
);

/* -------------------------------------------------------------------- service */

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 19.5 5.8v6c0 4.3-3.1 7.7-7.5 9.2-4.4-1.5-7.5-4.9-7.5-9.2v-6Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);

/* ------------------------------------------------------------- kpi + attention */

export const IconTrend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 3.5v17h17" />
    <path d="m7 14.5 3.5-4 3 2.5 5-6" />
    <path d="M15 7h3.5v3.5" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4.5M12 17.2h.01" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.75" />
    <path d="M12 6.75V12l3.5 2" />
  </Svg>
);

export const IconLowStock = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 2.5 19.5h19Z" />
    <path d="M12 9.5v4.2M12 16.6h.01" />
  </Svg>
);

export const IconReturn = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.9-6.4" />
    <path d="M3.5 4v5h5" />
  </Svg>
);

/* --------------------------------------------------------------- chrome + ui */

export const IconBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 8.75a6 6 0 1 0-12 0c0 4.75-2 6.25-2 6.25h16s-2-1.5-2-6.25Z" />
    <path d="M10.2 18.5a2 2 0 0 0 3.6 0" />
  </Svg>
);

export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
  </Svg>
);

export const IconX = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.6-3.6" />
  </Svg>
);

export const IconArrow = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h15" />
    <path d="m13.5 6.5 5.5 5.5-5.5 5.5" />
  </Svg>
);

export const IconActivity = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />
  </Svg>
);

export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);

export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5 10.1 12.8 4.5 10.9 10.1 9Z" />
  </Svg>
);
