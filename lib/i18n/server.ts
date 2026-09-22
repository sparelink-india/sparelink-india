import { cookies } from "next/headers";

import { dictionaries, type MessageKey } from "@/lib/i18n/messages";
import { LOCALE_COOKIE } from "@/lib/i18n";

export async function getServerMessages(): Promise<Record<MessageKey, string>> {
  const locale = (await cookies()).get(LOCALE_COOKIE)?.value === "hi" ? "hi" : "en";
  return dictionaries[locale];
}
