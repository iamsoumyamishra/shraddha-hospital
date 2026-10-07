"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Every chart is paired with a real table carrying the same numbers.
 *
 * The table is the accessible equivalent of the chart, not a fallback: colour and
 * position are never the only way a value is conveyed, and the underlying figures
 * are readable by assistive technology and by anyone preferring plain numbers.
 */

export interface CategoryDatum {
  key: string;
  label: string;
  score: number | null;
  responseCount: number;
  suppressed: boolean;
}

export function CategoryScoresCard({
  title,
  description,
  data,
  labels,
}: {
  title: string;
  description: string;
  data: CategoryDatum[];
  labels: {
    table: string;
    category: string;
    score: string;
    responses: string;
    suppressed: string;
    smallSample: string;
  };
}) {
  const visible = data.filter((item) => item.score !== null && !item.suppressed);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {visible.length === 0 ? null : (
          <div className="w-full" style={{ height: Math.max(200, visible.length * 40 + 32) }} aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visible} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [Number(value).toFixed(1), labels.score]} />
                <Bar dataKey="score" fill="var(--color-chart-1)" barSize={16} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <Table className="text-xs sm:text-sm">
          <caption className="sr-only">{labels.table}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.category}</TableHead>
              <TableHead className="text-right">{labels.score}</TableHead>
              <TableHead className="text-right">{labels.responses}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.key}>
                <TableCell className="font-medium">{item.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.score === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : item.suppressed ? (
                    <span className="text-muted-foreground">{labels.suppressed}</span>
                  ) : (
                    item.score.toFixed(1)
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.responseCount}
                  {item.suppressed ? (
                    <span className="block text-xs text-muted-foreground">
                      {labels.smallSample}
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export interface DistributionDatum {
  rating: number;
  label: string;
  count: number;
}

export function RatingDistributionCard({
  title,
  description,
  data,
  labels,
}: {
  title: string;
  description: string;
  data: DistributionDatum[];
  labels: { table: string; rating: string; count: string };
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <>
            <div className="h-48 w-full" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ left: 4, right: 16 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <Tooltip />
                  {/* A sequential ramp, not five arbitrary hues: the rating
                      scale is ordered, so the encoding should be too. Every bar
                      now clears 3:1 against the card background. */}
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {data.map((item) => (
                      <Cell key={item.rating} fill={`var(--rating-${item.rating})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Table className="text-xs sm:text-sm">
              <caption className="sr-only">{labels.table}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>{labels.rating}</TableHead>
                  <TableHead className="text-right">{labels.count}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.rating}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export interface TrendDatum {
  periodStart: string;
  /** Formatted on the server: a formatter function cannot be serialised to a client component. */
  periodLabel: string;
  averageIndex: number | null;
  completedCount: number;
}

export function TrendCard({
  title,
  description,
  data,
  labels,
}: {
  title: string;
  description: string;
  data: TrendDatum[];
  labels: { table: string; week: string; index: string; responses: string };
}) {
  const chartData = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <>
            <div className="h-48 w-full" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 4, right: 16 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="periodLabel" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={40} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="averageIndex"
                    name={labels.index}
                    stroke="var(--color-chart-1)"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: "var(--color-chart-1)" }}
                    activeDot={{ r: 4.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Table className="text-xs sm:text-sm">
              <caption className="sr-only">{labels.table}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>{labels.week}</TableHead>
                  <TableHead className="text-right">{labels.index}</TableHead>
                  <TableHead className="text-right">{labels.responses}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.map((point) => (
                  <TableRow key={point.periodStart}>
                    <TableCell className="font-medium">{point.periodLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {point.averageIndex === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        point.averageIndex.toFixed(1)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{point.completedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}