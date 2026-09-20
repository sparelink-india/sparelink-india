import type { MessageKey } from "@/lib/i18n";
import type { NavGroup } from "@/lib/category-navigation";

export const NAV_GROUP_KEYS: Record<string, MessageKey> = {
  lubricants: "navGroup.lubricants",
  "window-regulator": "navGroup.window-regulator",
  "water-pump-assy": "navGroup.water-pump-assy",
  bonnet: "navGroup.bonnet",
  cables: "navGroup.cables",
  filters: "navGroup.filters",
  fluids: "navGroup.fluids",
  braking: "navGroup.braking",
  suspension: "navGroup.suspension",
  engine: "navGroup.engine",
  electricals: "navGroup.electricals",
  controls: "navGroup.controls",
  "locks-latches": "navGroup.locks-latches",
  body: "navGroup.body",
  mirrors: "navGroup.mirrors",
  wipers: "navGroup.wipers",
  fuel: "navGroup.fuel",
  seats: "navGroup.seats",
  tools: "navGroup.tools",
  other: "navGroup.other",
};

export function navGroupLabel(
  group: Pick<NavGroup, "id" | "name">,
  t: (key: MessageKey) => string,
): string {
  const key = NAV_GROUP_KEYS[group.id];
  return key ? t(key) : group.name;
}
