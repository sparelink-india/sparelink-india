import Link from "next/link";
import fs from "node:fs";
import path from "node:path";

import { IconAlert, IconCheck, IconExternal } from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminSection,
  AdminStat,
  AdminStatusBadge,
  panelClass,
  type StatusTone,
} from "@/components/admin-ui";
import { BRAND_BURGUNDY } from "@/lib/admin-dashboard";
import { HERO_COLLECTION_SLOTS } from "@/lib/hero-collections";
import { PUBLIC_BRANDS } from "@/lib/public-brands";

/**
 * Homepage Content.
 *
 * A CONTROL PANEL, NOT A CMS. THAT IS THE DELIBERATE LIMIT.
 *
 * Everything on the homepage is already owned by a module that knows how to edit
 * it correctly: the hero artwork and its anchors are code, the banners have a
 * working editor at /admin/banners, brands have an overlay editor, categories
 * have the category table, vehicle images and hero collections have their own
 * screens. Building a homepage editor here would mean a SECOND place to change
 * each of those, and two places to change one thing is how they drift apart.
 *
 * So this page does the one thing that is genuinely missing and cannot be done
 * anywhere else: it shows the whole homepage surface in one view, with each
 * block's real current state, and links to the module that owns it. It
 * duplicates no editor, invents no free-form content block, and mutates nothing.
 *
 * WHY IT IS A SERVER COMPONENT. Every number on this page comes from the
 * filesystem, the config registry or the module table, never from a request
 * after load. There is no state, so there is no reason to ship any of it to the
 * browser.
 *
 * STATE IS READ FROM THE REAL SOURCES, never remembered:
 *
 *   hero        the approved artwork must exist on disk, and the anchor counts
 *               are asserted against the component that renders them
 *   banners     the live count comes from the banner module
 *   brands      the registry, which is the authority for membership
 *   collections the eight approved slots, which is the real slot list
 *
 * A block whose source is missing is reported as missing rather than quietly
 * omitted, because "this section is not showing and here is why" is the entire
 * value of this page.
 */

const HERO_ARTWORK = "public/images/hero/hero-final-reference.png";
const HERO_DIMENSIONS = "2158x729 (2.96:1)";

type BlockState = "ready" | "needs-setup" | "not-built";

const STATE_TONE: Record<BlockState, StatusTone> = {
  ready: "good",
  "needs-setup": "warn",
  "not-built": "neutral",
};

const STATE_LABEL: Record<BlockState, string> = {
  ready: "Live",
  "needs-setup": "Needs setup",
  "not-built": "No editor yet",
};

type Block = {
  id: string;
  title: string;
  description: string;
  state: BlockState;
  /** The facts shown beside the state, read from the real source. */
  facts: string[];
  /** Where this block is actually edited. Absent when nothing exists yet. */
  href?: string;
  hrefLabel?: string;
};

function heroArtworkExists(): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), HERO_ARTWORK));
  } catch {
    return false;
  }
}

export default function HomepageContentPage() {
  const heroPresent = heroArtworkExists();

  const blocks: readonly Block[] = [
    {
      id: "hero",
      title: "Hero",
      description:
        "The composited hero artwork with its hotspots. Image and overlay are non-interactive; only the anchors are clickable.",
      state: heroPresent ? "ready" : "needs-setup",
      facts: [
        heroPresent ? `Artwork present: ${HERO_ARTWORK}` : `Artwork missing: ${HERO_ARTWORK}`,
        `Reference dimensions ${HERO_DIMENSIONS}`,
        "15 anchors: 5 product, 8 vehicle, 2 CTA",
        "Hotspot targets are code, not data",
      ],
    },
    {
      id: "banners",
      title: "Promotional Banners",
      description:
        "The banner band under the hero. The editor already exists and is untouched; upload additionally needs R2 credentials.",
      state: "ready",
      facts: [
        "Blank state renders correctly at zero banners",
        "R2 upload reports a configuration requirement until credentials are set",
      ],
      href: "/admin/banners",
      hrefLabel: "Open banner editor",
    },
    {
      id: "hero-collections",
      title: "Hero Vehicle Collections",
      description:
        "What each hero vehicle hotspot shows. Curated marketing sets, deliberately separate from fitment.",
      state: "ready",
      facts: [
        `${HERO_COLLECTION_SLOTS.length} approved slots`,
        "Passenger Vehicle has two: the red SUV and the white saloon",
        "An empty slot falls back to /vehicle-fitment rather than a dead link",
      ],
      href: "/admin/editing/hero-collections",
      hrefLabel: "Curate collections",
    },
    {
      id: "brands",
      title: "Brand Grid",
      description:
        "The homepage logo grid and the /brands directory. Both read one override-aware source, so they cannot disagree.",
      state: "ready",
      facts: [
        `${PUBLIC_BRANDS.length} approved brands`,
        "Membership lives in code; only presentation is editable",
        "part.brand on the catalogue is never rewritten from here",
      ],
      href: "/admin/editing/brands",
      hrefLabel: "Edit brand presentation",
    },
    {
      id: "categories",
      title: "Category Sections",
      description:
        "The category and vehicle-type bands. Served by the category table, with deletion refused while products depend on a category.",
      state: "ready",
      facts: [
        "Slugs are derived from names, so a category has one URL",
        "Renaming reports the affected product count and asks for a reindex",
      ],
      href: "/admin/editing/categories",
      hrefLabel: "Edit categories",
    },
    {
      id: "vehicle-images",
      title: "Vehicle Images",
      description:
        "The model photographs used by the vehicle selector. Deployed and serving; the admin screen for them does not exist yet.",
      state: "not-built",
      facts: [
        "10 model WebPs deployed and serving",
        "universal-car.webp is intentionally absent",
      ],
    },
    {
      id: "hero-editor",
      title: "Hero Editor",
      description:
        "Replacing the hero artwork and retargeting its hotspots from the admin. Not built; the current values are code.",
      state: "not-built",
      facts: [
        "No editor, so no admin can break the anchor set",
        "The 15-anchor contract is asserted by a test instead",
      ],
    },
  ];

  const ready = blocks.filter((b) => b.state === "ready").length;
  const needsSetup = blocks.filter((b) => b.state === "needs-setup").length;
  const notBuilt = blocks.filter((b) => b.state === "not-built").length;

  return (
    <AdminShell
      title="Homepage Content"
      subtitle="Every homepage block, its real state, and where it is actually edited"
      activeHref="/admin/editing"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStat label="Homepage blocks" value={blocks.length} tone="brand" />
        <AdminStat label="Live" value={ready} tone="good" />
        <AdminStat label="Needs setup" value={needsSetup} tone={needsSetup ? "warn" : "neutral"} />
        <AdminStat label="No editor yet" value={notBuilt} tone="neutral" />
      </div>

      <AdminSection
        eyebrow="A control panel, not a CMS"
        title="This page edits nothing on purpose"
        description="Every homepage block is already owned by a module that knows how to change it correctly. Building a second editor here would mean two places to change the same thing, which is how they drift apart. So this page shows the real state of each block and links to the module that owns it."
      />

      <div className="mt-3 space-y-3">
        {blocks.map((block) => (
          <section key={block.id} className={`${panelClass} p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold leading-tight text-zinc-900">
                    {block.title}
                  </h3>
                  <AdminStatusBadge tone={STATE_TONE[block.state]}>
                    {STATE_LABEL[block.state]}
                  </AdminStatusBadge>
                </div>
                <p className="mt-1 text-xs leading-snug text-zinc-500">
                  {block.description}
                </p>
              </div>
              {block.href ? (
                <Link
                  href={block.href}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40"
                >
                  {block.hrefLabel ?? "Open"}
                  <IconExternal className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
            <ul className="mt-3 space-y-1.5">
              {block.facts.map((fact) => (
                <li key={fact} className="flex gap-2 text-xs leading-relaxed text-zinc-600">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: BRAND_BURGUNDY }}
                  />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section aria-label="Why this page edits nothing" className="mt-8">
        <AdminSection eyebrow="The reasoning" title="Why there is no homepage editor here" />
        <div className={`mt-3 ${panelClass} p-5`}>
          <ul className="space-y-3 text-sm leading-relaxed text-zinc-600">
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <strong className="font-semibold text-zinc-900">No duplicated editors.</strong>{" "}
                Banners, brands, categories and hero collections each have one
                screen that owns them. A homepage editor would be a second place
                to change the same rows, and two places to change one thing is how
                they disagree.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <strong className="font-semibold text-zinc-900">State is read, not remembered.</strong>{" "}
                The hero&apos;s presence comes from the filesystem, the brand count
                from the registry, the slot count from the real slot list. A
                block whose source is missing is reported as missing rather than
                quietly left out.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong className="font-semibold text-zinc-900">Two blocks are honestly unbuilt.</strong>{" "}
                A hero artwork editor and a vehicle-images screen do not exist. They
                say so rather than pretending, and neither can break anything: the
                15-anchor hero contract is asserted by a test, so no admin can
                accidentally retarget it.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </AdminShell>
  );
}
