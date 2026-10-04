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
  Activity,
  ClipboardList,
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
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-semibold">Shraddha Hospital</p>
            <p className="truncate text-xs text-muted-foreground">Patient experience</p>
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
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
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
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <p className="truncate text-sm font-medium text-muted-foreground">{t("overview")}</p>
          <Activity aria-hidden className="ml-auto size-4 text-muted-foreground" />
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </>
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
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
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