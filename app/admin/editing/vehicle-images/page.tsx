import { IconAlert, IconCheck, IconStack, IconUpload } from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import { VehicleImageManager } from "@/components/admin-vehicle-image-manager";
import { AdminInlineLink, AdminNotice, AdminStat, AdminStatBand } from "@/components/admin-ui";
import { loadVehicleImageInventory } from "@/lib/admin-vehicle-images";
import { formatCount } from "@/lib/admin-dashboard";

/**
 * /admin/editing/vehicle-images
 *
 * A server component on purpose. The inventory is a join of the vehicle
 * catalogue, the filesystem and the licence manifest, all of which are
 * server-side concerns, so it is read once here and handed to the client half as
 * props. The browser then receives only the rows it renders, never a directory
 * listing it has to re-filter.
 *
 * `force-dynamic` because the answer is the current state of the disk and the
 * database. A cached inventory would let an admin look at yesterday's files
 * after someone regenerates the images.
 *
 * `activeHref` is the PARENT route on purpose. The admin rail marks the active
 * entry by exact string equality, so passing "/admin/editing" keeps Editing
 * Studio highlighted on this sub-page without adding a second sidebar entry -
 * which is the convention for every other admin sub-page.
 *
 * NO MUTATION HAPPENS HERE. There is no API route behind this screen. The
 * storage finding is documented at length in `lib/admin-vehicle-images.ts`: the
 * images are committed files under `public/`, a build-time directory, so an
 * admin upload would succeed in `next dev` and silently do nothing on the
 * deployed Vercel instance. Shipping that would be worse than not offering it.
 */

export const dynamic = "force-dynamic";

export default async function VehicleImagesPage() {
  const { rows, summary, catalogueLoaded } = await loadVehicleImageInventory();

  return (
    <AdminShell
      title="Vehicle Images"
      subtitle="Every fitment model photograph, with its file and licence provenance"
      activeHref="/admin/editing"
    >
      <div className="mb-4">
        <AdminInlineLink href="/admin/editing">Back to Editing Studio</AdminInlineLink>
      </div>

      {/* ------------------------------------------------------------- summary */}
      <section aria-label="Vehicle image summary">
        <AdminStatBand>
          <AdminStat
            label="Models"
            value={formatCount(summary.models)}
            hint="Models in the fitment catalogue"
            tone="brand"
            icon={<IconStack className="h-5 w-5" />}
          />
          <AdminStat
            label="Image present"
            value={formatCount(summary.present)}
            hint="Resolved from a file on disk"
            tone={summary.present > 0 ? "good" : "neutral"}
            icon={<IconCheck className="h-5 w-5" />}
          />
          <AdminStat
            label="Intentionally absent"
            value={formatCount(summary.pending)}
            hint="Excluded on purpose, not a gap"
            icon={<IconAlert className="h-5 w-5" />}
          />
          <AdminStat
            label="Awaiting an image"
            value={formatCount(summary.missing)}
            hint="No file and no manifest entry"
            tone={summary.missing > 0 ? "warn" : "neutral"}
            icon={<IconUpload className="h-5 w-5" />}
          />
        </AdminStatBand>
      </section>

      <div className="mt-4">
        <AdminNotice message="This screen is read-only. Vehicle images are committed build files, so replacing one goes through the image manifest and pipeline rather than an upload." />
      </div>

      {/* ------------------------------------------------------------- modules */}
      <VehicleImageManager rows={rows} catalogueLoaded={catalogueLoaded} />
    </AdminShell>
  );
}
