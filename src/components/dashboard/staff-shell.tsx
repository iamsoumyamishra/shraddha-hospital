"use client";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";

import { BrandMark } from "@/components/branding/brand-mark";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
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
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  RefreshCw,
  ShieldCheck,
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
  const tAuth = useTranslations("auth");
  const tBrand = useTranslations("brand");
  const tUi = useTranslations("ui");
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <>
      <a href="#staff-content" className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">{tUi("skipToContent")}</a>
      {/* Sidebar tooltips need their own provider; the rest of the app does not use them. */}
      <TooltipProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-20 justify-center px-4 group-data-[collapsible=icon]:px-2">
          <div className="flex items-center gap-2.5 px-1 py-1">
            <BrandMark className="size-9" />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
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
          <SidebarGroup className="px-3 py-6 group-data-[collapsible=icon]:px-2">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground group-data-[collapsible=icon]:hidden">{tUi("navigation")}</p>
            <SidebarGroupContent>
              {/* A landmark, so a screen reader user can jump straight to the
                  section links instead of tabbing through the whole page. */}
              <nav aria-label={t("label")}>
                <SidebarMenu className="gap-1.5">
                  {STAFF_NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      className="h-11 rounded-lg px-3 text-sm text-muted-foreground data-[active=true]:bg-accent data-[active=true]:font-semibold data-[active=true]:text-primary"
                      isActive={isActive(item)}
                      tooltip={t(item.key)}
                      onClick={() => setOpenMobile(false)}
                    >
                      <Link href={item.href} aria-current={isActive(item) ? "page" : undefined}>
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
        <SidebarFooter className="gap-3 border-t border-sidebar-border p-3">
          {/* An initials chip gives the footer a recognisable anchor without
              needing to load an avatar image. */}
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-3 py-3 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-0">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/15 bg-accent text-xs font-semibold text-primary"
            >
              {initials(displayName)}
            </span>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium leading-tight">{displayName}</p>
              <p className="truncate text-xs leading-tight text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={tAuth("signOut")}
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
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-sm sm:px-6 lg:h-20 lg:px-8">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5!" />
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{tUi("workspace")}</span>
            <ChevronRight aria-hidden className="hidden size-3.5 text-muted-foreground sm:block" />
            <span className="truncate font-medium">{t(STAFF_NAV.find(isActive)?.key ?? "overview")}</span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ShieldCheck aria-hidden className="hidden size-4 text-primary sm:block" />
            <span className="hidden text-xs text-muted-foreground md:block">{roleLabel}</span>
            <span aria-hidden className="grid size-8 place-items-center rounded-full border border-border bg-muted text-xs font-semibold">{initials(displayName)}</span>
          </div>
          <LanguageSwitcher />
        </header>
        <main id="staff-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 p-4 outline-none sm:p-6 lg:p-8">{children}</main>
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
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
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
      <RefreshCw aria-hidden className="size-3.5" />
      {t("refresh")}
    </Button>
  );
}