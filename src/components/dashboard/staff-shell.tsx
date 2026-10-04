"use client";

import Link from "next/link";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

export interface NavItem {
  key: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

export const STAFF_NAV: NavItem[] = [
  { key: "mainDashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { key: "phiIndex", href: "/dashboard/phi", icon: TrendingUp },
  { key: "responses", href: "/dashboard/responses", icon: ClipboardList },
  { key: "cases", href: "/dashboard/cases", icon: LifeBuoy },
];

export function StaffShell({
  children,
  displayName,
  roleLabel,
}: {
  children: ReactNode;
  displayName: string;
  roleLabel: string;
}) {
  return (
    <SidebarProvider>
      <SidebarNav displayName={displayName} roleLabel={roleLabel}>{children}</SidebarNav>
    </SidebarProvider>
  );
}

/**
 * Everything that calls `useSidebar` must render beneath `SidebarProvider`, so
 * the shell is split in two rather than reaching for the context in the same
 * component that provides it.
 */
function SidebarNav({
  children,
  displayName,
  roleLabel,
}: {
  children: ReactNode;
  displayName: string;
  roleLabel: string;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tBrand = useTranslations("brand");
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <>
      {/* Sidebar tooltips need their own provider; the rest of the app does not use them. */}
      <TooltipProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-1 py-1">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-raised"
            >
              <HeartPulse className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight leading-tight">
                {tBrand("name")}
              </p>
              <p className="truncate text-xs leading-tight text-muted-foreground">
                {tBrand("tagline")}
              </p>
            </div>
          </div>
        </SidebarHeader>
        <Separator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              {/* A landmark, so a screen reader user can jump straight to the
                  section links instead of tabbing through the whole page. */}
              <nav aria-label={t("label")}>
                <SidebarMenu>
                  {STAFF_NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item)}
                      tooltip={t(item.key)}
                      onClick={() => setOpenMobile(false)}
                    >
                      <Link href={item.href}>
                        <item.icon aria-hidden />
                        <span>{t(item.key)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {/* An initials chip gives the footer a recognisable anchor without
              needing to load an avatar image. */}
          <div className="flex items-center gap-2.5 rounded-lg bg-accent/50 px-2 py-2">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              {initials(displayName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{displayName}</p>
              <p className="truncate text-xs leading-tight text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={tCommon("close")}
                onClick={() => {
                  void authClient.signOut();
                }}
              >
                <LogOut aria-hidden />
                <span>{tAuth("signOut")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      </TooltipProvider>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <p className="truncate text-sm font-medium text-muted-foreground">{t("overview")}</p>
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"
            >
              <HeartPulse className="size-4" />
            </span>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </>
  );
}

/** First letters of a display name, for the sidebar footer chip. */
function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Page heading used by every dashboard screen. */
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Re-runs the server components for the current URL, keeping the filters in the
 * query string. Refresh rather than navigate so the period selection survives.
 */
export function RefreshButton() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" onClick={() => router.refresh()}>
      {t("refresh")}
    </Button>
  );
}