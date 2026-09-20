"use client";

import { useI18n } from "@/components/preferences-provider";
import type { MessageKey } from "@/lib/i18n";

export function T({
  k,
  vars,
}: {
  k: MessageKey;
  vars?: Record<string, string | number>;
}) {
  const { t } = useI18n();
  return <>{t(k, vars)}</>;
}
