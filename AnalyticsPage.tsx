import React, { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from "recharts";
import { ChevronLeft, Plane, LogOut, TrendingUp, Users, Receipt, Calendar, PieChart as PieIcon } from "lucide-react";
import { getTrip, computeBalances, getSession, logOut } from "../store";
import { Trip, TripMember, Expense } from "../types";

const CATEGORIES = [
  { value: "accommodation", label: "Accommodation", color: "#8B5CF6", bg: "#F5F3FF" },
  { value: "food",          label: "Food & Drinks",  color: "#F59E0B", bg: "#FFFBEB" },
  { value: "transport",     label: "Transport",       color: "#3B82F6", bg: "#EFF6FF" },
  { value: "activities",    label: "Activities",      color: "#EC4899", bg: "#FDF2F8" },
  { value: "shopping",      label: "Shopping",        color: "#14B8A6", bg: "#F0FDFA" },
  { value: "health",        label: "Health",          color: "#EF4444", bg: "#FEF2F2" },
  { value: "other",         label: "Other",           color: "#6B7280", bg: "#F3F4F6" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

const EMOJIS: Record<string, string> = {
  accommodation: "🏠", food: "🍽️", transport: "🚌",
  activities: "🎯", shopping: "🛍️", health: "💊", other: "📦",
};

function fmtAmt(n: number, cur: string) {
  return `${cur} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  currency: string;
}

const CustomTooltip = ({ active, payload, currency }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs font-semibold">
      <div className="font-bold text-gray-900 mb-1">{d.name || d.payload?.name}</div>
      <div style={{ color: d.color || "#1ec88f" }} className="font-serif text-sm">
        {fmtAmt(d.value, currency)}
      </div>
      {d.payload?.pct && (
        <div className="text-gray-400 text-[10px] mt-0.5">
          {d.payload.pct}% of total
        </div>
      )}
    </div>
  );
};

export default function AnalyticsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const session = getSession();
  const trip = getTrip(session?.id || "", tripId || "");

  function handleLogout() {
    logOut();
    navigate("/auth", { replace: true });
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white select-none">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="font-serif text-2xl font-bold text-gray-900 mb-2">Trip Not Found</h2>
        <button
          onClick={() => navigate("/")}
          className="px-5 py-2.5 bg-[#1ec88f] hover:bg-[#17a876] text-white rounded-lg text-xs font-bold transition-all"
        >
          ← Back to Trips
        </button>
      </div>
    );
  }

  const totalSpent = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const balances = computeBalances(trip);

  // ── Category breakdown ────────────────────────────────────────────────────
  interface CategoryChartItem {
    name: string;
    value: number;
    color: string;
    pct: string;
    emoji: string;
  }

  const categoryData = useMemo<CategoryChartItem[]>(() => {
    const map: Record<string, number> = {};
    trip.expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return CATEGORIES
      .filter((c) => (map[c.value] || 0) > 0)
      .map((c) => ({
        name: c.label,
        value: Math.round((map[c.value] || 0) * 100) / 100,
        color: c.color,
        pct: totalSpent > 0 ? (((map[c.value] || 0) / totalSpent) * 100).toFixed(1) : "0",
        emoji: EMOJIS[c.value] || "📦",
      }))
      .sort((a, b) => b.value - a.value);
  }, [trip.expenses, totalSpent]);

  // ── Per-member spending ───────────────────────────────────────────────────
  const memberData = useMemo(() => {
    return trip.members.map((m) => {
      const paid = trip.expenses
        .flatMap((e) => e.paidBy || [])
        .filter((p) => p.memberId === m.id)
        .reduce((s, p) => s + p.amount, 0);
      const owes = trip.expenses
        .filter((e) => e.splitAmong.includes(m.id))
        .reduce((s, e) => s + e.amount / (e.splitAmong.length || 1), 0);
      return {
        name: m.name,
        Paid: Math.round(paid * 100) / 100,
        Share: Math.round(owes * 100) / 100
      };
    });
  }, [trip]);

  // ── Spending over time ────────────────────────────────────────────────────
  const timelineData = useMemo(() => {
    const map: Record<string, number> = {};
    trip.expenses.forEach((e) => {
      const d = e.date;
      map[d] = (map[d] || 0) + e.amount;
    });
    const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    let running = 0;
    return sorted.map(([date, amount]) => {
      running += amount;
      return {
        date: fmtDate(date),
        amount: Math.round(amount * 100) / 100,
        cumulative: Math.round(running * 100) / 100
      };
    });
  }, [trip.expenses]);

  // ── Category per member stacked charts ──────────────────────────────────────
  const memberCatData = useMemo(() => {
    return trip.members.map((m) => {
      const row: Record<string, any> = { name: m.name };
      CATEGORIES.forEach((c) => {
        row[c.label] = Math.round(
          trip.expenses
            .filter((e) => e.category === c.value && (e.paidBy || []).some((p) => p.memberId === m.id))
            .flatMap((e) => e.paidBy || [])
            .filter((p) => p.memberId === m.id)
            .reduce((s, p) => s + p.amount, 0)
          * 100) / 100;
      });
      return row;
    });
  }, [trip]);

  // ── Top 5 Expenses ────────────────────────────────────────────────────────
  const topExpenses = useMemo(() =>
    [...trip.expenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [trip.expenses]
  );

  // ── KPI numbers ───────────────────────────────────────────────────────────
  const avgExpense = trip.expenses.length > 0 ? totalSpent / trip.expenses.length : 0;
  const maxExpense = trip.expenses.length > 0 ? Math.max(...trip.expenses.map((e) => e.amount)) : 0;
  const topCategory = categoryData[0];
  const activeDaysCount = timelineData.length;

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-[100] bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between gap-4">
          <div className="flex-1">
            <button
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all font-sans"
              onClick={() => navigate(`/trip/${trip.id}`)}
              aria-label="Back"
            >
              <ChevronLeft size={16} />
              <span>Back to Trip</span>
            </button>
          </div>
          
          <div className="flex flex-col items-center text-center flex-2 min-w-0">
            <span className="font-serif text-[17px] font-bold text-gray-900 truncate max-w-xs block select-none">
              Trip Analytics Dashboard
            </span>
            <span className="text-[11px] text-gray-400 font-semibold truncate block max-w-[200px]">
              {trip.name}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-end gap-3 bg-white">
            <Link to="/" className="flex items-center gap-1.5 text-gray-500 hover:text-[#1ec88f] transition-all text-xs font-bold leading-none font-serif">
              <div className="w-6.5 h-6.5 bg-emerald-100/50 text-[#1ec88f] rounded-md flex items-center justify-center border border-emerald-100">
                <Plane size={11} strokeWidth={2.5} />
              </div>
              <span className="hidden sm:inline">SplitTrack</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg shrink-0 text-gray-400 hover:text-red-650 hover:bg-red-50 hover:border-red-150 transition-all"
              title="Log out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full flex flex-col gap-6">
        
        {/* KPI Metrics Dashboard Row */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[
            { label: "Total Spent", value: fmtAmt(totalSpent, trip.currency), icon: <TrendingUp size={16} className="text-[#1ec88f]" />, bg: "bg-emerald-50/50 text-emerald-700" },
            { label: "Avg per Cost", value: fmtAmt(avgExpense, trip.currency), icon: <Receipt size={16} className="text-blue-500" />, bg: "bg-blue-50/50 text-blue-700" },
            { label: "Largest cost", value: fmtAmt(maxExpense, trip.currency), icon: <TrendingUp size={16} className="text-red-500" />, bg: "bg-red-50/50 text-red-700" },
            { label: "Active Days", value: activeDaysCount, icon: <Calendar size={16} className="text-indigo-500" />, bg: "bg-indigo-50/50 text-indigo-700" },
            { label: "Top Category", value: topCategory ? `${topCategory.emoji} ${topCategory.name.split(" ")[0]}` : "—", icon: <PieIcon size={16} className="text-amber-500" />, bg: "bg-amber-50/50 text-amber-700" },
            { label: "Per Traveler", value: fmtAmt(totalSpent / (trip.members.length || 1), trip.currency), icon: <Users size={16} className="text-teal-500" />, bg: "bg-teal-50/50 text-teal-700" },
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white border border-gray-150 rounded-xl p-4 flex items-center gap-3 shadow-xs">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${kpi.bg}`}>
                {kpi.icon}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{kpi.label}</span>
                <span className="font-serif text-sm font-bold text-gray-900 truncate block">{kpi.value}</span>
              </div>
            </div>
          ))}
        </section>

        {trip.expenses.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="font-serif text-lg font-bold text-gray-900 mb-1">No analysis stats computed</h3>
            <p className="text-xs text-gray-400 text-center max-w-xs mx-auto">Create and save dinner bills or flights first to see analytics graphs.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* Row 1: Pie + side-by-side Bar charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Category pie chart */}
              <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col gap-5">
                <div className="flex justify-between items-baseline border-b border-gray-50 pb-2">
                  <h3 className="font-serif text-[15px] font-bold text-gray-900">Spending by Category</h3>
                  <span className="text-xs text-gray-400 font-semibold">{trip.expenses.length} expenses logged</span>
                </div>
                
                <div className="w-full h-64 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryData.map((item, i) => (
                          <Cell key={i} fill={item.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip currency={trip.currency} />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry: any) => (
                          <span className="text-[11px] text-gray-600 font-semibold uppercase tracking-wider">
                            {entry.payload?.emoji} {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  {categoryData.map((c) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-32 shrink-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="text-xs text-gray-450 font-bold tracking-tight truncate">{c.name}</span>
                      </div>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: c.color }} />
                      </div>
                      <span className="text-right text-[10px] text-gray-400 font-bold w-10 shrink-0">{c.pct}%</span>
                      <span className="text-right text-xs font-bold text-gray-900 font-serif w-24 shrink-0">{fmtAmt(c.value, trip.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contributed vs Fair Share Bar Chart */}
              <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col gap-16">
                <div className="flex items-baseline justify-between border-b border-gray-50 pb-2">
                  <h3 className="font-serif text-sm font-bold text-gray-900">Who Paid vs Their Share</h3>
                  <span className="text-xs text-gray-400 font-medium">per group traveler</span>
                </div>
                
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memberData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7280" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                      <Tooltip content={<CustomTooltip currency={trip.currency} />} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Bar dataKey="Paid" fill="#1ec88f" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Share" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                  {trip.members.map((m) => {
                    const bal = balances[m.id] || 0;
                    const pos = bal >= 0;
                    const settled = Math.abs(bal) < 0.01;
                    return (
                      <div key={m.id} className="flex items-center justify-between p-2.5 bg-gray-50/50 border border-gray-100 rounded-xl text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <div className="w-6.5 h-6.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold flex items-center justify-center uppercase shrink-0">
                            {m.name[0]}
                          </div>
                          <span className="font-serif font-bold text-gray-950">{m.name}</span>
                        </div>
                        <span className={`font-bold ${settled ? "text-gray-400" : pos ? "text-emerald-600" : "text-red-500"}`}>
                          {settled ? "Settled" : (pos ? "+" : "") + fmtAmt(Math.abs(bal), trip.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Row 2: Cumulative Area chart over time */}
            {timelineData.length > 1 && (
              <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col gap-10">
                <div className="flex items-baseline justify-between border-b border-gray-50 pb-2">
                  <h3 className="font-serif text-[15px] font-bold text-gray-900">Spending Trends Over Time</h3>
                  <span className="text-xs text-gray-400 font-semibold">daily budget vs cumulative cost</span>
                </div>

                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradientCumulative" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1ec88f" stopOpacity={0.16} />
                          <stop offset="95%" stopColor="#1ec88f" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradientDaily" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                      <Tooltip content={<CustomTooltip currency={trip.currency} />} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Area type="monotone" dataKey="cumulative" name="Cumulative Spent" stroke="#1ec88f" strokeWidth={2.5} fill="url(#gradientCumulative)" dot={false} />
                      <Area type="monotone" dataKey="amount" name="Daily cost" stroke="#3B82F6" strokeWidth={2} fill="url(#gradientDaily)" dot={{ r: 3.5, strokeWidth: 1.5, fill: "#3B82F6" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Row 3: Category stacking + Top spending list */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Category Stacked Bars */}
              {trip.members.length > 1 && (
                <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col gap-10">
                  <div className="flex items-baseline justify-between border-b border-gray-50 pb-2">
                    <h3 className="font-serif text-[15px] font-bold text-gray-900">Category breakdown per traveler</h3>
                    <span className="text-xs text-gray-400 font-medium">how money was distributed by categories</span>
                  </div>

                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={memberCatData} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 650, fill: "#4B5563" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                        <Tooltip content={<CustomTooltip currency={trip.currency} />} />
                        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 600 }} />
                        {CATEGORIES.filter((c) => categoryData.some((d) => d.name === c.label)).map((c) => (
                          <Bar key={c.value} dataKey={c.label} stackId="col_stack" fill={c.color} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Top 5 expenses board */}
              <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                <div className="flex items-baseline justify-between border-b border-gray-50 pb-2">
                  <h3 className="font-serif text-[15px] font-bold text-gray-900">Top 5 Largest Costs</h3>
                  <span className="text-xs text-gray-400 font-medium">by absolute price weight</span>
                </div>

                <div className="flex flex-col gap-3">
                  {topExpenses.map((e, idx) => {
                    const cat = CAT_MAP[e.category] || CAT_MAP.other;
                    const pct = totalSpent > 0 ? (e.amount / totalSpent) * 100 : 0;
                    return (
                      <div key={e.id} className="flex items-center gap-3">
                        <div className={`w-7.5 h-7.5 rounded-full flex items-center justify-center text-xs font-bold text-gray-900 shrink-0 ${
                          idx === 0 ? "bg-amber-100" : idx === 1 ? "bg-slate-100" : "bg-orange-50"
                        }`}>
                          {idx + 1}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-gray-950 block truncate max-w-xs">{e.description}</span>
                          <span className="text-[10px] text-gray-400 font-bold block mt-0.5">
                            <span style={{ color: cat.color }}>{EMOJIS[e.category]} {cat.label}</span>
                            {" · "}{fmtDate(e.date)}
                          </span>
                          <div className="h-1 bg-gray-100 rounded-full w-full overflow-hidden mt-1.5">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat.color }} />
                          </div>
                        </div>

                        <div className="font-serif text-[13.5px] font-bold text-gray-950 shrink-0 whitespace-nowrap">
                          {fmtAmt(e.amount, trip.currency)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
