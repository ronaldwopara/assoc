"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ExpenseTypeSlice, MonthBucket, RosterStat } from "@/lib/dashboard-overview";

// Validated categorical palette (see the dataviz skill's references/palette.md) — fixed
// slot order, never cycled. Slots 1-2 are reserved for the Money In / Money Out identity
// used across every chart on this tab; slots 3-5 are a separate dimension (expense type)
// so reusing orange there wouldn't falsely imply "all Out is Invoices."
const SERIES = {
  in: "#2a78d6", // slot 1 — blue
  out: "#eb6834", // slot 2 — orange
  debit: "#1baf7a", // slot 3 — aqua
  invoice: "#eda100", // slot 4 — yellow
  receipt: "#e87ba4", // slot 5 — magenta
};
const STATUS_GOOD = "#0ca30c";
const STATUS_MUTED = "#c3c2b7";

type OverviewResponse = {
  cashFlow?: MonthBucket[];
  expenseByType?: ExpenseTypeSlice[];
  interac?: { matched: number; unmatched: number; totalIn: number };
  expenses?: { total: number; count: number };
  rosters?: RosterStat[];
  counts?: Array<{ label: string; value: number }>;
  errors?: string[];
  error?: string;
};

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

const RANGE_OPTIONS = [3, 6, 12, 24] as const;

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className={`dash-stat-tile${tone ? ` dash-stat-tile--${tone}` : ""}`}>
      <span className="dash-stat-label">{label}</span>
      <span className="dash-stat-value">{value}</span>
    </div>
  );
}

function CashFlowChart({ data }: { data: MonthBucket[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.in, d.out]));
  const chartH = 160;
  const barW = 14;
  const groupW = 44;
  const width = Math.max(1, data.length) * groupW + 24;

  return (
    <div className="dash-chart-wrap">
      <div className="dash-chart-head">
        <h3 className="dash-chart-title">Money in vs. money out</h3>
        <div className="dash-chart-legend">
          <span className="dash-legend-item">
            <i style={{ background: SERIES.in }} /> In
          </span>
          <span className="dash-legend-item">
            <i style={{ background: SERIES.out }} /> Out
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${chartH + 24}`} className="dash-chart-svg" role="img" aria-label="Money in versus money out by month">
        <line x1={12} y1={chartH} x2={width - 12} y2={chartH} stroke="#c3c2b7" strokeWidth={1} />
        {data.map((d, i) => {
          const x = 12 + i * groupW;
          const inH = (d.in / max) * (chartH - 12);
          const outH = (d.out / max) * (chartH - 12);
          return (
            <g key={d.month}>
              <rect x={x} y={chartH - inH} width={barW} height={inH} rx={3} fill={SERIES.in}>
                <title>{`${d.label}: In ${money.format(d.in)}`}</title>
              </rect>
              <rect x={x + barW + 3} y={chartH - outH} width={barW} height={outH} rx={3} fill={SERIES.out}>
                <title>{`${d.label}: Out ${money.format(d.out)}`}</title>
              </rect>
              <text x={x + barW + 1.5} y={chartH + 16} textAnchor="middle" className="dash-chart-axis-label">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ExpenseTypeChart({ data }: { data: ExpenseTypeSlice[] }) {
  const colorFor: Record<string, string> = { Debit: SERIES.debit, Invoice: SERIES.invoice, Receipt: SERIES.receipt };
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="dash-chart-wrap">
      <div className="dash-chart-head">
        <h3 className="dash-chart-title">Expenses by type</h3>
      </div>
      <div className="dash-hbar-list">
        {data.map((d) => (
          <div className="dash-hbar-row" key={d.type}>
            <span className="dash-hbar-label">
              <i style={{ background: colorFor[d.type] }} />
              {d.type}
            </span>
            <div className="dash-hbar-track" title={`${money.format(d.total)} across ${d.count} email${d.count === 1 ? "" : "s"}`}>
              <div
                className="dash-hbar-fill"
                style={{ width: `${(d.total / max) * 100}%`, background: colorFor[d.type] }}
              />
            </div>
            <span className="dash-hbar-value">{money.format(d.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RosterChart({ data }: { data: RosterStat[] }) {
  return (
    <div className="dash-chart-wrap">
      <div className="dash-chart-head">
        <h3 className="dash-chart-title">Paid vs. unpaid</h3>
        <div className="dash-chart-legend">
          <span className="dash-legend-item">
            <i style={{ background: STATUS_GOOD }} /> Paid
          </span>
          <span className="dash-legend-item">
            <i style={{ background: STATUS_MUTED }} /> Unpaid
          </span>
        </div>
      </div>
      <div className="dash-hbar-list">
        {data.map((d) => {
          const total = Math.max(1, d.paid + d.unpaid);
          return (
            <div className="dash-hbar-row" key={d.label}>
              <span className="dash-hbar-label">{d.label}</span>
              <div className="dash-stack-track">
                <div
                  className="dash-stack-seg"
                  style={{ width: `${(d.paid / total) * 100}%`, background: STATUS_GOOD }}
                  title={`${d.paid} paid`}
                />
                <div
                  className="dash-stack-seg"
                  style={{ width: `${(d.unpaid / total) * 100}%`, background: STATUS_MUTED }}
                  title={`${d.unpaid} unpaid`}
                />
              </div>
              <span className="dash-hbar-value">
                {d.paid} / {d.paid + d.unpaid}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardOverviewPanel() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [months, setMonths] = useState<number>(6);

  const load = useCallback((range: number) => {
    setLoading(true);
    setError("");
    fetch(`/api/dashboard/overview?months=${range}`, { cache: "no-store" })
      .then((res) => res.json() as Promise<OverviewResponse>)
      .then((body) => {
        if (body.error) setError(body.error);
        else setData(body);
      })
      .catch(() => setError("Failed to load the overview."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(months);
  }, [months, load]);

  const cashFlow = data?.cashFlow ?? [];
  const periodIn = cashFlow.reduce((sum, m) => sum + m.in, 0);
  const periodOut = cashFlow.reduce((sum, m) => sum + m.out, 0);
  const net = periodIn - periodOut;

  return (
    <div className="dash-panel">
      <header className="dash-panel-head">
        <div className="dash-panel-heading">
          <h2 className="dash-panel-title">Overview</h2>
          <p className="dash-panel-sub">Cash flow, expenses, and roster status across the last {months} months.</p>
        </div>
        <div className="dash-panel-actions">
          <div className="dash-actions-row dash-actions-row--primary">
            <label className="dash-select-wrap">
              <select
                className="dash-select focus-ring-light"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                aria-label="Timeline range"
              >
                {RANGE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    Last {m} months
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="dash-action-btn focus-ring-light"
              onClick={() => load(months)}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "dash-spin" : undefined} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {loading && (
        <div className="dash-empty">
          <p className="dash-muted">Loading…</p>
        </div>
      )}

      {!loading && error && (
        <div className="dash-empty">
          <p>Couldn&rsquo;t load the overview.</p>
          <p className="dash-muted">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="dash-overview">
          <div className="dash-stat-row">
            <StatTile label={`Money in (${months} mo.)`} value={money.format(periodIn)} />
            <StatTile label={`Money out (${months} mo.)`} value={money.format(periodOut)} />
            <StatTile label="Net" value={money.format(net)} tone={net >= 0 ? "good" : "warn"} />
            <StatTile
              label="Unmatched e-Transfers"
              value={String(data.interac?.unmatched ?? 0)}
              tone={(data.interac?.unmatched ?? 0) > 0 ? "warn" : "good"}
            />
          </div>

          <div className="dash-chart-grid">
            <CashFlowChart data={cashFlow} />
            <ExpenseTypeChart data={data.expenseByType ?? []} />
            <RosterChart data={data.rosters ?? []} />
          </div>

          <div className="dash-stat-row">
            {(data.counts ?? []).map((c) => (
              <StatTile key={c.label} label={c.label} value={String(c.value)} />
            ))}
          </div>

          {(data.errors?.length ?? 0) > 0 && (
            <p className="dash-muted dash-overview-note">
              Some sheets couldn&rsquo;t be read: {data.errors!.join("; ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
