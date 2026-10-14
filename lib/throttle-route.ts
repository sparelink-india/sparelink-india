/**
 * One-line throttle insertion helper for Next.js route handlers.
 *
 * Exists so each protected route gets the identical guard, and so the policy
 * name is a compile-checked constant rather than a string literal that can be
 * mistyped at a call site.
 *
 * Usage inside a handler:
 *   const blocked = await throttleRoute(request, "checkout");
 *   if (blocked) return blocked;
 */

import {
  MUTATION_POLICIES,
  throttleAuthRequest,
  throttleMutation,
} from "@/lib/auth-throttle";

export type MutationPolicyName = keyof typeof MUTATION_POLICIES;

export async function throttleRoute(
  request: Request,
  policy: MutationPolicyName,
) {
  return throttleMutation({ request, policy: MUTATION_POLICIES[policy] });
}

export { throttleAuthRequest };