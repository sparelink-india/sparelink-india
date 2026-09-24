"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useI18n } from "@/components/preferences-provider";

type NavKey = "home" | "search" | "orders" | "cart" | "account";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2m1.2-4.3a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  );
}

function OrdersIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6M7 9h10M7 13h6M6 3h12a1 1 0 011 1v16l-4-2-4 2-4-2-4 2V4a1 1 0 011-1z" />
    </svg>
  );
}

function CartIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2 6h14M10 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  );
}

function AccountIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 1116 0" />
    </svg>
  );
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c81e1e] px-1 text-[10px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function MobileBottomNav({
  cartCount: cartCountProp,
}: {
  cartCount?: number;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [fetchedCartCount, setFetchedCartCount] = useState<number | null>(null);
  const cartCount = typeof cartCountProp === "number" ? cartCountProp : (fetchedCartCount ?? 0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof cartCountProp === "number") {
      return;
    }
    let active = true;
    void fetch("/api/cart", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && typeof data.itemCount === "number") {
          setFetchedCartCount(data.itemCount);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [cartCountProp, pathname]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const covered = window.innerHeight - vv.height;
      setKeyboardOpen(covered > 120);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  if (keyboardOpen) return null;

  const focusSearch = searchParams.get("focus") === "search";
  const items: {
    key: NavKey;
    href: string;
    label: string;
    active: boolean;
    badge?: number;
    icon: (props: { active: boolean }) => ReactNode;
  }[] = [
    {
      key: "home",
      href: "/",
      label: t("nav.home"),
      active: pathname === "/" && !focusSearch && !searchParams.get("q"),
      icon: HomeIcon,
    },
    {
      key: "search",
      href: "/?focus=search",
      label: t("nav.search"),
      active: pathname === "/" && (focusSearch || Boolean(searchParams.get("q"))),
      icon: SearchIcon,
    },
    {
      key: "orders",
      href: "/orders",
      label: t("nav.orders"),
      active: pathname.startsWith("/orders"),
      icon: OrdersIcon,
    },
    {
      key: "cart",
      href: "/cart",
      label: t("nav.cart"),
      active: pathname.startsWith("/cart") || pathname.startsWith("/checkout"),
      badge: cartCount,
      icon: CartIcon,
    },
    {
      key: "account",
      href: "/profile",
      label: t("mobile.account"),
      active:
        pathname.startsWith("/profile") ||
        pathname.startsWith("/wishlist") ||
        pathname.startsWith("/account") ||
        pathname.startsWith("/login"),
      icon: AccountIcon,
    },
  ];

  return (
    <nav
      className="mobile-bottom-nav md:hidden"
      aria-label={t("mobile.primaryNav")}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5 px-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="min-w-0 flex-1">
              <Link
                href={item.href}
                className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-semibold transition-colors ${
                  item.active
                    ? "text-[#7a1233]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                aria-current={item.active ? "page" : undefined}
              >
                <span className="relative inline-flex">
                  <Icon active={item.active} />
                  {item.badge != null ? <Badge count={item.badge} /> : null}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
