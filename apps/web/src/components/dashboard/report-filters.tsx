"use client";

import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Report filters live in the query string so a view is shareable, survives a
 * refresh and re-renders on the server. The browser never becomes the authority
 * for scope: the server clamps whatever arrives to the signed-in staff member's
 * memberships.
 */
export function ReportFilters({
  defaults,
  visitTypes,
  branchOptions,
  scopeAllBranches,
}: {
  defaults: { from: string; to: string };
  visitTypes: string[];
  branchOptions: FilterOption[];
  scopeAllBranches: boolean;
}) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? defaults.from;
  const to = searchParams.get("to") ?? defaults.to;
  const visitType = searchParams.get("visitType") ?? "all";
  const branchId = searchParams.get("branchId") ?? "all";

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <form
      className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:grid-cols-2 sm:p-5 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        apply({ from, to, visitType, branchId });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="filter-from">{t("filters.periodFrom")}</Label>
        <Input
          id="filter-from"
          type="date"
          className="h-10 min-w-0 w-full"
          value={from}
          max={to}
          onChange={(event) => apply({ from: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-to">{t("filters.periodTo")}</Label>
        <Input
          id="filter-to"
          type="date"
          className="h-10 min-w-0 w-full"
          value={to}
          min={from}
          onChange={(event) => apply({ to: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-visit">{t("filters.visitType")}</Label>
        <Select value={visitType} onValueChange={(value) => apply({ visitType: value })}>
          <SelectTrigger id="filter-visit" className="h-10! w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allVisitTypes")}</SelectItem>
            {visitTypes.map((type) => (
              <SelectItem key={type} value={type} className="capitalize">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {scopeAllBranches ? (
        <div className="space-y-2">
          <Label htmlFor="filter-branch">{t("table.branch")}</Label>
          <Select value={branchId} onValueChange={(value) => apply({ branchId: value })}>
            <SelectTrigger id="filter-branch" className="h-10! w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allBranches")}</SelectItem>
              {branchOptions.map((branch) => (
                <SelectItem key={branch.value} value={branch.value}>
                  {branch.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-1">
        <Button type="submit" className="w-full xl:w-auto">
          {t("filters.period")}
        </Button>
      </div>
    </form>
  );
}