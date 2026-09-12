import { auth } from "@/lib/auth";

export async function getServerSession() {
  return auth.api.getSession({
    headers: await (async () => {
      const { headers } = await import("next/headers");
      return headers();
    })(),
  });
}
