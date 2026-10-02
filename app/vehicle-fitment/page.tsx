import { FitmentModelGrid } from "@/components/vehicle-fitment/model-grid";
import { FitmentShell } from "@/components/vehicle-fitment/fitment-shell";
import { loadFitmentCatalog } from "@/lib/load-fitment";
import { getServerMessages } from "@/lib/i18n/server";
import { routeMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = routeMetadata({
  path: "/vehicle-fitment",
  title: "Find Spare Parts by Vehicle - Make, Model and Year",
  description:
    "Select your vehicle make and model to see only the auto spare parts that fit it, from braking and engine parts to filters, electricals and lubricants.",
});

export default async function VehicleFitmentPage() {
  const { brands } = await loadFitmentCatalog();
  const messages = await getServerMessages();

  return (
    <FitmentShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-[var(--v3-text)] sm:text-3xl">
          {messages["fitment.title"]}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--v3-text-2)]">{messages["fitment.hint"]}</p>
        {brands.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--v3-text-3)]">{messages["fitment.empty"]}</p>
        ) : (
          brands.map((brand) => (
            <FitmentModelGrid
              key={brand.slug}
              brand={brand}
              compatiblePartsLabel={messages["fitment.compatibleParts"]}
            />
          ))
        )}
        <p className="mt-12 text-xs leading-relaxed text-[var(--v3-text-3)]">
          {messages["fitment.photoCredits"]}
        </p>
      </div>
    </FitmentShell>
  );
}
