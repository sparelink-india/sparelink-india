import type { ReactNode } from "react";
import Link from "next/link";

import {
  IconActivity,
  IconAlert,
  IconBoxes,
  IconCommand,
  IconDatabase,
  IconExternal,
  IconGrid,
  IconList,
  IconPriceTag,
  IconSliders,
  IconStack,
  IconTrend,
  IconTruck,
  IconUpload,
  IconUsers,
} from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminSection,
  AdminStat,
  AdminStatusBadge,
  panelClass,
  type StatusTone,
} from "@/components/admin-ui";
import { BRAND_BURGUNDY } from "@/lib/admin-dashboard";

/**
 * Editing Studio — phase 1.
 *
 * ONE JOB: centralise where website and catalogue editing will live, and say
 * honestly which modules exist today and which do not.
 *
 * WHY THIS PAGE IS A SERVER COMPONENT. It renders a fixed module table and
 * fetches nothing. There is no state, so there is no reason to ship the
 * catalogue constants to the browser. The interactive pieces it reuses
 * (`AdminShell`, `AdminStatusBadge`) are client components and cross that
 * boundary on their own.
 *
 * WHY THE MODULE LIST IS DATA, NOT MARKUP. Ten modules with a title, a
 * description, an icon, a status and an optional destination is a table, and a
 * table is what the rest of the admin already treats as the unit of work
 * (`ADMIN_FEATURES`, `summariseProducts`, `*_FILTERS`). Adding a module means
 * adding a row here, not editing a grid of JSX.
 *
 * STATUS IS DELIBERATELY HONEST. `available` means a real screen exists and is
 * reachable now, and `planned` means there is no route behind it yet. Those
 * cards are NOT links. A card that navigates to a 404 is worse than a card that
 * plainly says the work is not built, so a module without a destination renders
 * as static content and says so.
 *
 * `available` therefore tracks shipped screens, not available data. Vehicle
 * Compatibility is marked planned because no admin screen for it exists yet,
 * even though the compatibility data behind it is real and ready.
 *
 * NOTHING HERE MUTATES. There is no form, no fetch and no server action on
 * this page. Editing capability arrives module by module, each with its own
 * audited, admin-only write path; this page is the index those modules hang
 * from.
 *
 * `AdminFeatureCard` is deliberately NOT used for the grid. It requires an
 * `href` and always renders a `Link`, which is the wrong control for a module
 * that has no destination yet. The card below copies its visual language -
 * same radius, same hover lift, same burgundy accent rail - and adds the
 * status badge the module table needs.
 */

const FOCUS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40 focus-visible:ring-offset-1";

/** Where a module stands. `planned` modules have no route behind them yet. */
type ModuleStatus = "available" | "planned" | "external";

const STATUS_LABEL: Record<ModuleStatus, string> = {
  available: "Available",
  planned: "Planned",
  external: "Open existing editor",
};

const STATUS_TONE: Record<ModuleStatus, StatusTone> = {
  available: "good",
  planned: "neutral",
  external: "info",
};

type Module = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  status: ModuleStatus;
  /**
   * Present only when a real screen already exists. A module with no `href`
   * must not be given one until that screen is built, because the admin
   * feature test asserts every nav entry resolves to a real page and a
   * placeholder route would break that promise for real.
   */
  href?: string;
};

const ICON_CLASS = "h-5 w-5";

/**
 * The ten approved modules, in the order the brief lists them.
 *
 * STATUS IS THE WHOLE POINT OF THIS TABLE, so it is worth being precise about
 * what each value claims:
 *
 *   available  a real screen exists at `href` and a real admin-only API backs
 *              it. Clickable.
 *   external   the capability is real but already lives somewhere else, so this
 *              card links to THAT screen instead of duplicating it. Promotional
 *              Banners is the case: the banner editor shipped and works, and
 *              building a second one would give two places to manage the same
 *              rows.
 *   planned    no screen exists. Deliberately NOT a link. A card that navigates
 *              to a 404 is worse than one that plainly says the work is not
 *              built.
 *
 * `available` TRACKS SHIPPED SCREENS, NOT AVAILABLE DATA. Two modules are marked
 * planned despite the data behind them being real, and both say why in their
 * own copy. That distinction is the difference between an honest index and a
 * wish list.
 *
 * NO DUPLICATE IDS. An earlier version of this table listed Hero Vehicle
 * Collections twice, once available and once planned, and the admin feature test
 * could not catch it because the second entry was simply ignored as a duplicate
 * React key. A uniqueness assertion now runs at module load, so a repeated id is
 * a startup error rather than a silently missing card.
 */
const MODULES: readonly Module[] = [
  {
    id: "hero-homepage",
    title: "Hero & Homepage",
    description:
      "Replace the hero artwork and manage its hotspot targets. The artwork and its 15 anchors are deployed; no editor for them yet.",
    icon: <IconActivity className={ICON_CLASS} />,
    status: "planned",
  },
  {
    id: "vehicle-images",
    title: "Vehicle Images",
    description: "Preview every fitment model photograph and its source licence.",
    icon: <IconUpload className={ICON_CLASS} />,
    status: "planned",
  },
  {
    id: "hero-vehicle-collections",
    title: "Hero Vehicle Collections",
    description:
      "Curate the product set each hero vehicle hotspot shows. Kept separate from fitment on purpose.",
    icon: <IconTruck className={ICON_CLASS} />,
    status: "available",
    href: "/admin/editing/hero-collections",
  },
  {
    id: "vehicle-compatibility",
    title: "Vehicle Compatibility",
    description: "Read-only: inspect which parts are linked to each fitment vehicle.",
    icon: <IconStack className={ICON_CLASS} />,
    status: "available",
    href: "/admin/editing/vehicle-compatibility",
  },
  {
    id: "product-images",
    title: "Product Images",
    description:
      "Derived image state for every product, with single-image replacement. Uploads need R2 credentials.",
    icon: <IconBoxes className={ICON_CLASS} />,
    status: "available",
    href: "/admin/editing/product-images",
  },
  {
    id: "product-information",
    title: "Product Information",
    description:
      "Names, OEM references and classification, one product at a time. Price and stock live elsewhere by design.",
    icon: <IconPriceTag className={ICON_CLASS} />,
    status: "available",
    href: "/admin/editing/product-information",
  },
  {
    id: "categories",
    title: "Categories",
    description:
      "The existing category table, with deletion refused while products depend on a category.",
    icon: <IconList className={ICON_CLASS} />,
    status: "available",
    href: "/admin/editing/categories",
  },
  {
    id: "brands",
    title: "Brands",
    description:
      "Presentation overrides for the nine approved brands. Membership stays in code and part.brand is never rewritten.",
    icon: <IconUsers className={ICON_CLASS} />,
    status: "available",
    href: "/admin/editing/brands",
  },
  {
    id: "promotional-banners",
    title: "Promotional Banners",
    description: "The existing banner editor: upload, order, enable and preview.",
    icon: <IconGrid className={ICON_CLASS} />,
    status: "external",
    href: "/admin/banners",
  },
  {
    id: "homepage-content",
    title: "Homepage Content",
    description:
      "A single view of the hero, banners, brand and category settings, linking to the module that owns each one.",
    icon: <IconSliders className={ICON_CLASS} />,
    status: "available",
    href: "/admin/editing/homepage",
  },
];

/**
 * Fail loudly on a repeated module id.
 *
 * A duplicate id is invisible at render time: React drops the second card and
 * the grid quietly shows one fewer module than the table claims, with no error
 * anywhere. That is exactly the "false absence" this page exists to prevent, so
 * it is a startup assertion rather than a lint rule.
 */
const DUPLICATE_MODULE_IDS = MODULES.map((m) => m.id).filter(
  (id, i, all) => all.indexOf(id) !== i,
);
if (DUPLICATE_MODULE_IDS.length > 0) {
  throw new Error(
    `Editing Studio module ids must be unique. Duplicated: ${[...new Set(DUPLICATE_MODULE_IDS)].join(", ")}`,
  );
}

/**
 * One module card.
 *
 * Renders as a link only when the module has a destination. A planned module
 * is inert on purpose: it carries a status badge and a muted cursor so the
 * difference between "built" and "not built yet" is visible before you click.
 */
function ModuleCard({ module }: { module: Module }) {
  const isActionable = module.status !== "planned";
  const accent = module.status === "available" ? BRAND_BURGUNDY : "#52525b";

  const body = (
    <>
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 origin-top transition-transform duration-200 ${
          isActionable ? "scale-y-0 group-hover:scale-y-100" : "scale-y-0"
        }`}
        style={{ backgroundColor: accent }}
      />
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 ${
          isActionable ? "group-hover:scale-105" : ""
        }`}
        style={{ backgroundColor: `${accent}12`, color: accent }}
      >
        {module.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-tight text-zinc-900">
          {module.title}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
          {module.description}
        </span>
        <span className="mt-2 inline-block">
          <AdminStatusBadge tone={STATUS_TONE[module.status]}>
            {STATUS_LABEL[module.status]}
          </AdminStatusBadge>
        </span>
      </span>
      <span
        className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
          isActionable
            ? "text-zinc-300 transition-all duration-200 group-hover:bg-zinc-100 group-hover:text-[#7a1233]"
            : "text-zinc-200"
        }`}
      >
        <IconExternal className="h-3.5 w-3.5" />
      </span>
    </>
  );

  const shell = `group relative flex items-start gap-3 overflow-hidden rounded-2xl border bg-white p-4 ${
    isActionable
      ? "border-zinc-200 transition-all duration-200 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_14px_34px_-14px_rgba(15,23,42,0.4)]"
      : "border-dashed border-zinc-200"
  } ${isActionable ? FOCUS : ""}`;

  if (module.href) {
    return (
      <Link href={module.href} className={shell}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}

export default function EditingStudioPage() {
  const available = MODULES.filter((module) => module.status === "available").length;
  const planned = MODULES.filter((module) => module.status === "planned").length;
  const external = MODULES.filter((module) => module.status === "external").length;

  return (
    <AdminShell
      title="Editing Studio"
      subtitle="Every visual and content editing tool for the storefront, in one place"
      activeHref="/admin/editing"
    >
      {/* ------------------------------------------------------------- summary */}
      <section aria-label="Editing Studio summary">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStat
            label="Modules"
            value={MODULES.length}
            hint="Planned editing areas in total"
            tone="brand"
            icon={<IconCommand className="h-5 w-5" />}
          />
          <AdminStat
            label="Available"
            value={available}
            hint="Built and reachable now"
            tone="good"
            icon={<IconTrend className="h-5 w-5" />}
          />
          <AdminStat
            label="Planned"
            value={planned}
            hint="No route or API yet"
            icon={<IconAlert className="h-5 w-5" />}
          />
          <AdminStat
            label="Existing editors"
            value={external}
            hint="Reused, never duplicated"
            icon={<IconDatabase className="h-5 w-5" />}
          />
        </div>
      </section>

      {/* -------------------------------------------------------------- modules */}
      <section aria-label="Editing modules" className="mt-6">
        <AdminSection
          eyebrow="Modules"
          title="Editing modules"
          description="Each module is built on its own audited, admin-only write path. Cards marked Planned have no screen behind them yet and are deliberately not links."
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((module) => (
            <ModuleCard key={module.id} module={module} />
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- how it works */}
      <section aria-label="How the studio works" className="mt-6">
        <AdminSection
          eyebrow="How this works"
          title="One home, no duplicate editors"
          description="New editing capability lands here instead of as another sidebar entry."
        />
        <div className={`mt-3 ${panelClass} p-5`}>
          <ul className="space-y-3 text-sm leading-relaxed text-zinc-600">
            <li className="flex gap-2.5">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a1233]" />
              <span>
                <strong className="font-semibold text-zinc-900">Reuse before building.</strong>{" "}
                Promotional Banners opens the existing banner editor at{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[12px]">/admin/banners</code>
                . That screen is untouched and stays the single place banners are managed.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a1233]" />
              <span>
                <strong className="font-semibold text-zinc-900">No status is guessed.</strong>{" "}
                A module is marked Available only when a real screen and a real admin-only API
                exist for it. Everything else says Planned.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a1233]" />
              <span>
                <strong className="font-semibold text-zinc-900">This page changes nothing.</strong>{" "}
                It renders a fixed module list and mutates nothing. Every future write path
                arrives with its own server-side authorisation and audit trail.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a1233]" />
              <span>
                <strong className="font-semibold text-zinc-900">Catalogue scale is respected.</strong>{" "}
                Compatibility and product tools will page server-side. The studio will never
                load the full catalogue into the browser.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </AdminShell>
  );
}
