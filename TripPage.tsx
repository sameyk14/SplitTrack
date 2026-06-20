import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Plus, Trash2, Users, Receipt, BarChart2, ArrowRightLeft,
  Edit2, UserPlus, ChevronLeft, Plane, LogOut, ChevronDown, ChevronUp,
  Share2, FileText, Table, Download, Image, X, Search, CheckCircle2,
  RotateCcw, PieChart, FileCode, Home, Crown
} from "lucide-react";
import Modal from "../components/Modal";
import {
  getTrip, addExpense, deleteExpense, updateExpense,
  addMember, removeMember, computeBalances, computeSettlements,
  getSession, logOut, markSettled, unmarkSettled, isSettled, Settlement,
  addFamily, removeFamily, updateFamilyPayer, computeFamilySettlements
} from "../store";
import { Trip, Expense, TripMember, PayerContribution, Family } from "../types";

const DEFAULT_CATEGORIES = [
  { value: "accommodation", label: "🏠 Accommodation", color: "#8B5CF6", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  { value: "food",          label: "🍽️ Food & Drinks",  color: "#F59E0B", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  { value: "transport",     label: "🚌 Transport",       color: "#3B82F6", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  { value: "activities",    label: "🎯 Activities",      color: "#EC4899", bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
  { value: "shopping",      label: "🛍️ Shopping",        color: "#14B8A6", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  { value: "health",        label: "💊 Health",          color: "#EF4444", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  { value: "other",         label: "📦 Other",           color: "#6B7280", bg: "bg-gray-105", text: "text-gray-700", border: "border-gray-200" },
];

const CUSTOM_CATEGORIES_KEY = "splittrack_custom_categories";

function loadCustomCategories() {
  try {
    const stored = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load custom categories", e);
  }
  return [];
}

function saveCustomCategories(categories: any[]) {
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
  } catch (e) {
    console.error("Failed to save custom categories", e);
  }
}

const TABS = [
  { id: "expenses", label: "Expenses",   Icon: Receipt },
  { id: "balances", label: "Balances",   Icon: BarChart2 },
  { id: "settle",   label: "Settle Up",  Icon: ArrowRightLeft },
  { id: "families", label: "Families",   Icon: Home },
  { id: "members",  label: "Members",    Icon: Users },
];

function getCat(val: string, categories: any[] = DEFAULT_CATEGORIES) {
  return categories.find((c) => c.value === val) || categories[categories.length - 1];
}

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const session = getSession();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("expenses");
  const [showAddExp, setShowAddExp] = useState(false);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [delExpId, setDelExpId] = useState<string | null>(null);
  const [delMemberId, setDelMemberId] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [delFamilyId, setDelFamilyId] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [categories, setCategories] = useState(() => [...DEFAULT_CATEGORIES, ...loadCustomCategories()]);

  const refresh = useCallback(() => {
    if (!session || !tripId) return;
    const t = getTrip(session.id, tripId);
    setTrip(t);
    setLoading(false);
  }, [tripId, session?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleLogout() {
    logOut();
    navigate("/auth", { replace: true });
  }

  function handleDeleteExpense() {
    if (!session || !trip || !delExpId) return;
    deleteExpense(session.id, trip.id, delExpId);
    setDelExpId(null);
    refresh();
  }

  function handleDeleteMember() {
    if (!session || !trip || !delMemberId) return;
    removeMember(session.id, trip.id, delMemberId);
    setDelMemberId(null);
    refresh();
  }

  function handleDeleteFamily() {
    if (!session || !trip || !delFamilyId) return;
    removeFamily(session.id, trip.id, delFamilyId);
    setDelFamilyId(null);
    refresh();
  }

  function handleAddFamily(data: { name: string; memberNames: string[]; payerName: string }) {
    if (!session || !trip) return;
    addFamily(session.id, trip.id, data);
    setShowAddFamily(false);
    refresh();
  }

  function handleChangePayer(familyId: string, newPayerId: string) {
    if (!session || !trip) return;
    updateFamilyPayer(session.id, trip.id, familyId, newPayerId);
    refresh();
  }

  function handleAddCategory(newCategory: { value: string; label: string; color: string }) {
    const categoryWithStyles = {
      ...newCategory,
      bg: `bg-[${newCategory.color}]/10`,
      text: `text-[${newCategory.color}]`,
      border: `border-[${newCategory.color}]/20`,
    };
    const updatedCategories = [...categories, categoryWithStyles];
    setCategories(updatedCategories);
    
    // Save only custom categories to localStorage
    const customCats = updatedCategories.filter(c => 
      !DEFAULT_CATEGORIES.some(dc => dc.value === c.value)
    );
    saveCustomCategories(customCats);
    setShowAddCategory(false);
  }

  if (loading) return <Skeleton />;
  if (!trip) return <NotFound />;

  const totalSpent = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const balances = computeBalances(trip);
  const settlements = trip.tripType === "family" && trip.families && trip.families.length > 0
    ? computeFamilySettlements(trip)
    : computeSettlements(trip);
  const settledCount = settlements.filter((s) => isSettled(trip, s.from, s.to)).length;

  function getMember(id: string) {
    return trip!.members.find((m) => m.id === id);
  }

  function getMemberName(id: string) {
    return getMember(id)?.name || "Unknown";
  }

  function getFamilyName(memberId: string) {
    if (!trip?.families) return null;
    const family = trip.families.find((f) => f.members.includes(memberId));
    return family?.name || null;
  }

  const fmtAmt = (n: number) =>
    `${trip.currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      {/* Sticky Sub-Header */}
      <header className="sticky top-0 z-[100] bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 flex-shrink-0 animate-in fade-in duration-200">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between gap-4">
          <div className="flex-1">
            <button
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
              onClick={() => navigate("/")}
              aria-label="Back"
            >
              <ChevronLeft size={16} />
              <span>All Trips</span>
            </button>
          </div>
          
          <div className="flex flex-col items-center text-center flex-2 min-w-0">
            <span className="font-serif text-[17px] font-bold text-gray-900 truncate max-w-xs md:max-w-md">
              {trip.name}
            </span>
            <span className="text-[11px] text-gray-400 font-semibold mt-0.5">
              {trip.members.length} members · {trip.currency}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-end gap-3.5 bg-white">
            <button
              className="hover:scale-[1.01] flex items-center gap-1.5 px-3 py-1.5 border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap"
              onClick={() => navigate(`/trip/${trip.id}/analytics`)}
              title="View analytics"
            >
              <PieChart size={13} />
              <span className="hidden sm:inline">Analytics</span>
            </button>
            
            <button
              className="hover:scale-[1.01] flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-[#1ec88f] hover:text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap"
              onClick={() => setShowShare(true)}
              title="Share / Export trip"
            >
              <Share2 size={13} />
              <span className="hidden sm:inline">Share</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-lg shrink-0 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-150 transition-all"
              title="Log out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full animate-in fade-in duration-200">
        
        {/* Statistics highlights bar */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Spent", value: fmtAmt(totalSpent) },
            { label: "Per Person", value: fmtAmt(totalSpent / (trip.members.length || 1)) },
            { label: "Expenses count", value: trip.expenses.length },
            { label: "Settle pairs", value: `${settledCount} / ${settlements.length} Settled` },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-150 rounded-xl p-4 flex flex-col gap-1 shadow-xs">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{s.label}</span>
              <span className="font-serif text-lg font-bold text-gray-900 leading-tight">{s.value}</span>
            </div>
          ))}
        </section>

        {/* Tab Selection */}
        <div className="flex border-b-2 border-gray-100 mb-8 gap-1 overflow-x-auto scrollbar-none" role="tablist">
          {TABS.filter(({ id }) => id !== "families" || trip.tripType === "family").map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold tracking-wide border-b-2 -mb-[2px] transition-all whitespace-nowrap rounded-t-lg ${
                tab === id
                  ? "border-[#1ec88f] text-[#1ec88f] font-bold"
                  : "border-transparent text-gray-400 hover:text-gray-900 hover:bg-gray-50/50"
              }`}
              onClick={() => setTab(id)}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Render Active Tab Pane */}
        <div className="tab-pane animate-in fade-in duration-200" role="tabpanel">
          {tab === "expenses" && (
            <ExpensesTab
              trip={trip}
              getMemberName={getMemberName}
              fmtAmt={fmtAmt}
              onAdd={() => setShowAddExp(true)}
              onEdit={(e) => setEditExp(e)}
              onDelete={(id) => setDelExpId(id)}
              onAddCategory={() => setShowAddCategory(true)}
              categories={categories}
            />
          )}
          {tab === "balances" && (
            <BalancesTab trip={trip} balances={balances} fmtAmt={fmtAmt} />
          )}
          {tab === "settle" && (
            <SettleTab
              trip={trip}
              settlements={settlements}
              getMemberName={getMemberName}
              getFamilyName={getFamilyName}
              fmtAmt={fmtAmt}
              userId={session?.id || ""}
              tripId={trip.id}
              onRefresh={refresh}
            />
          )}
          {tab === "members" && (
            <MembersTab
              trip={trip}
              balances={balances}
              fmtAmt={fmtAmt}
              onAdd={() => setShowAddMember(true)}
              onDelete={(id) => setDelMemberId(id)}
            />
          )}
          {tab === "families" && trip.tripType === "family" && (
            <FamiliesTab
              trip={trip}
              balances={balances}
              fmtAmt={fmtAmt}
              onAddFamily={() => setShowAddFamily(true)}
              onDeleteFamily={(id) => setDelFamilyId(id)}
              onChangePayer={handleChangePayer}
              getMemberName={getMemberName}
            />
          )}
        </div>
      </main>

      {/* Add/Edit Expense modal */}
      <ExpenseModal
        open={showAddExp || !!editExp}
        onClose={() => {
          setShowAddExp(false);
          setEditExp(null);
        }}
        trip={trip}
        expense={editExp}
        onSaved={() => {
          refresh();
          setShowAddExp(false);
          setEditExp(null);
        }}
        userId={session?.id || ""}
        tripId={trip.id}
        categories={categories}
        onAddCategory={handleAddCategory}
      />

      {/* Add Member modal */}
      <AddMemberModal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        userId={session?.id || ""}
        tripId={trip.id}
        onSaved={() => {
          refresh();
          setShowAddMember(false);
        }}
      />

      {/* Add Family modal */}
      <AddFamilyModal
        open={showAddFamily}
        onClose={() => setShowAddFamily(false)}
        onSaved={handleAddFamily}
      />

      {/* Delete Family Modal */}
      <Modal open={!!delFamilyId} onClose={() => setDelFamilyId(null)} title="Remove family?" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            Are you sure you want to remove this family from the trip?
          </p>
          <p className="text-xs text-red-500 leading-relaxed bg-red-50 border border-red-100 p-3 rounded-lg font-medium">
            Warning: This will remove all family members and their expenses from this trip!
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              className="px-4 py-2 border border-gray-250 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-semibold transition-colors"
              onClick={() => setDelFamilyId(null)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-all shadow-md shadow-red-500/10"
              onClick={handleDeleteFamily}
            >
              Remove Family
            </button>
          </div>
        </div>
      </Modal>

      {/* Share / Export Trip modal */}
      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        trip={trip}
        getMemberName={getMemberName}
        balances={balances}
        settlements={settlements}
      />

      <AddCategoryModal
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onAdd={handleAddCategory}
        existingCategories={categories}
      />


      {/* Delete Expense Modal */}
      <Modal open={!!delExpId} onClose={() => setDelExpId(null)} title="Delete expense?" size="sm">
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Are you sure you want to permanently delete this expense? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 border border-gray-250 text-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-semibold transition-colors button-id-cancel-exp"
            onClick={() => setDelExpId(null)}
            id="cancel-del-expense"
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-all shadow-md shadow-red-500/10 hover:scale-[1.01]"
            onClick={handleDeleteExpense}
            id="confirm-del-expense"
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Delete Member Modal */}
      <Modal open={!!delMemberId} onClose={() => setDelMemberId(null)} title="Remove member?" size="sm">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 leading-relaxed">
            Are you sure you want to remove <strong className="text-gray-900">{getMemberName(delMemberId || "")}</strong> from this trip?
          </p>
          <p className="text-xs text-red-500 leading-relaxed bg-red-50 border border-red-100 p-3 rounded-lg font-medium">
            Warning: This will also delete all of their logged expenses, sub-contributions, and settlement history from this trip!
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              className="px-4 py-2 border border-gray-250 text-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-semibold transition-colors"
              onClick={() => setDelMemberId(null)}
              id="cancel-del-member"
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-all shadow-md shadow-red-500/10 hover:scale-[1.01]"
              onClick={handleDeleteMember}
              id="confirm-del-member"
            >
              Remove Member
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Expenses Tab Component ───────────────────────────────────────────────────
interface ExpensesTabProps {
  trip: Trip;
  getMemberName: (id: string) => string;
  fmtAmt: (n: number) => string;
  onAdd: () => void;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
  onAddCategory: () => void;
  categories: any[];
}

function ExpensesTab({ trip, getMemberName, fmtAmt, onAdd, onEdit, onDelete, onAddCategory, categories }: ExpensesTabProps) {
  const [filterCat, setFilterCat] = useState("all");
  const [filterPaidBy, setFilterPaidBy] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  const filtered = trip.expenses
    .filter((e) => filterCat === "all" || e.category === filterCat)
    .filter((e) => filterPaidBy === "all" || (e.paidBy || []).some((p) => p.memberId === filterPaidBy))
    .filter((e) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.description.toLowerCase().includes(q) ||
        getCat(e.category, categories).label.toLowerCase().includes(q) ||
        (e.paidBy || []).some((p) => getMemberName(p.memberId).toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === "amount") cmp = a.amount - b.amount;
      if (sortBy === "desc") cmp = a.description.localeCompare(b.description);
      return sortDir === "asc" ? cmp : -cmp;
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-1.5">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search bar inside toolbar left */}
          <div className="relative flex items-center flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3.5 text-gray-400 pointer-events-none" />
            <input
              className="w-full pl-9.5 pr-8 py-2 border border-gray-250 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 outline-none transition-all"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="absolute right-2.5 text-gray-400 hover:text-gray-600 p-1"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <select
            className="px-3 py-2 border border-gray-250 rounded-lg text-sm bg-white text-gray-800 focus:border-[#1ec88f] outline-none cursor-pointer"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            aria-label="Category filter"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            className="px-3 py-2 border border-gray-250 rounded-lg text-sm bg-white text-gray-800 focus:border-[#1ec88f] outline-none cursor-pointer"
            value={filterPaidBy}
            onChange={(e) => setFilterPaidBy(e.target.value)}
            aria-label="Payer filter"
          >
            <option value="all">All payers</option>
            {trip.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onAddCategory}
          className="flex items-center justify-center gap-1.5 px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
        >
          <Plus size={14} /> Add Category
        </button>

        <button
          onClick={onAdd}
          className="flex items-center justify-center gap-1.5 px-4 py-2 border border-[#1ec88f] bg-emerald-500 hover:bg-[#17a876] text-white rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
        >
          <Plus size={14} /> Add Expense
        </button>
      </div>

      {/* Expenses Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No expenses found"
          sub={
            search || filterCat !== "all" || filterPaidBy !== "all"
              ? "No expenses fell into this filter arrangement. Try adjusting your fields."
              : "Keep it simple and add your first cost to start tracking bills."
          }
        >
          {!search && filterCat === "all" && filterPaidBy === "all" && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1ec88f] hover:bg-[#17a876] text-white rounded-lg text-sm font-semibold transition-colors mt-2"
            >
              <Plus size={14} />
              <span>Add Expense</span>
            </button>
          )}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto border border-gray-150 rounded-2xl bg-white shadow-xs">
          <table className="w-full border-collapse text-left text-sm" aria-label="Expenses list">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-150 text-[11px] font-bold text-gray-400 uppercase tracking-wider select-none">
                <th className="py-3 px-5 w-24">Category</th>
                <th className="py-3 px-5">
                  <button
                    className="flex items-center gap-1 font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-wider text-[11px]"
                    onClick={() => toggleSort("desc")}
                  >
                    <span>Description</span>
                    <SortIcon active={sortBy === "desc"} dir={sortDir} />
                  </button>
                </th>
                <th className="py-3 px-5">
                  <button
                    className="flex items-center gap-1 font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-wider text-[11px]"
                    onClick={() => toggleSort("date")}
                  >
                    <span>Date</span>
                    <SortIcon active={sortBy === "date"} dir={sortDir} />
                  </button>
                </th>
                <th className="py-3 px-5">Paid by</th>
                <th className="py-3 px-5">Split among</th>
                <th className="py-3 px-5">
                  <button
                    className="flex items-center gap-1 font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-wider text-[11px]"
                    onClick={() => toggleSort("amount")}
                  >
                    <span>Amount</span>
                    <SortIcon active={sortBy === "amount"} dir={sortDir} />
                  </button>
                </th>
                <th className="py-3 px-5 w-24" aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((exp) => {
                const cat = getCat(exp.category, categories);
                const paidBy = exp.paidBy || [];
                const isCombined = paidBy.length > 1;
                
                return (
                  <tr key={exp.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cat.bg} ${cat.text} ${cat.border} border`}>
                        {cat.label.split(" ")[0]}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-gray-900 truncate max-w-[180px]" title={exp.description}>
                      {exp.description}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(exp.date)}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200/80 rounded-xl text-xs font-semibold ${isCombined ? "bg-emerald-50/70 border-emerald-100 text-emerald-800" : "text-gray-800"}`}>
                        {isCombined && <span className="w-1.5 h-1.5 rounded-full bg-[#1ec88f] shrink-0" />}
                        <div className="flex flex-col">
                          {paidBy.map((p, idx) => (
                            <span key={p.memberId} className="inline-flex items-center gap-1.5 py-0.5">
                              <span className="font-bold">{getMemberName(p.memberId)}</span>
                              {isCombined && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-900 whitespace-nowrap">
                                  {trip.currency} {p.amount.toFixed(2)}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-gray-500 max-w-[140px] truncate" title={exp.splitAmong.map(getMemberName).join(", ")}>
                      {exp.splitAmong.length === trip.members.length
                        ? "Everyone"
                        : exp.splitAmong.map((id) => getMemberName(id)).join(", ")}
                    </td>
                    <td className="py-3.5 px-5 font-serif text-[15px] font-bold text-gray-900 whitespace-nowrap">
                      {fmtAmt(exp.amount)}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5">
                        <button
                          className="w-7 h-7 rounded-md border border-gray-150 hover:border-emerald-200 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 flex items-center justify-center transition-all"
                          onClick={() => onEdit(exp)}
                          title="Edit expense"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="w-7 h-7 rounded-md border border-gray-150 hover:border-red-200 text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all"
                          onClick={() => onDelete(exp.id)}
                          title="Delete expense"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronDown size={11} className="opacity-35" />;
  return dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

// ── Balances Tab Component ───────────────────────────────────────────────────
interface BalancesTabProps {
  trip: Trip;
  balances: Record<string, number>;
  fmtAmt: (n: number) => string;
}

function BalancesTab({ trip, balances, fmtAmt }: BalancesTabProps) {
  const maxAbs = Math.max(...Object.values(balances).map(Math.abs), 1);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 py-3 px-4 bg-gray-50 border border-gray-200/80 rounded-xl leading-relaxed">
        <strong>💡 Balance Tip:</strong> Positive balance signals you are owed money, whereas a negative balance signals you owe.
      </p>
      
      <div className="flex flex-col gap-3.5 bg-white border border-gray-150 rounded-2xl p-6 shadow-xs">
        {trip.members.length === 0 ? (
          <EmptyState icon="👥" title="No members added" sub="Ensure members are logged to compute splits." />
        ) : (
          trip.members
            .slice()
            .sort((a, b) => (balances[b.id] || 0) - (balances[a.id] || 0))
            .map((member) => {
              const bal = balances[member.id] || 0;
              const pct = Math.abs(bal) / maxAbs;
              const pos = bal >= 0;
              const settled = Math.abs(bal) < 0.01;
              return (
                <div key={member.id} className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 w-44 shrink-0">
                    <div className="w-8.5 h-8.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[12px] flex items-center justify-center shrink-0 uppercase select-none border border-emerald-100">
                      {member.name[0]}
                    </div>
                    <span className="font-semibold text-gray-950 truncate">{member.name}</span>
                  </div>
                  
                  {/* Custom progress distribution weight bar */}
                  <div className="flex-1 h-2 bg-gray-150 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${pos ? "bg-[#1ec88f]" : "bg-red-400"}`}
                      style={{ width: `${Math.max(pct * 100, 2)}%` }}
                    />
                  </div>

                  <div className="flex items-center md:justify-end gap-3.5 min-w-[220px]">
                    <span className={`font-serif text-[15px] font-bold whitespace-nowrap min-w-[100px] text-right ${settled ? "text-gray-400" : pos ? "text-emerald-600" : "text-red-500"}`}>
                      {pos ? "+" : ""}{fmtAmt(Math.abs(bal))}
                    </span>
                    
                    <span className={`inline-flex px-2.5 py-0.8 rounded-full text-[10px] font-bold uppercase tracking-wider text-center w-24 justify-center ${
                      settled ? "bg-gray-100 text-gray-400" : pos ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}>
                      {settled ? "settled" : pos ? "gets back" : "owes"}
                    </span>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

// ── Settle Up Tab Component ──────────────────────────────────────────────────
interface SettleTabProps {
  trip: Trip;
  settlements: Settlement[];
  getMemberName: (id: string) => string;
  getFamilyName: (id: string) => string | null;
  fmtAmt: (n: number) => string;
  userId: string;
  tripId: string;
  onRefresh: () => void;
}

function SettleTab({ trip, settlements, getMemberName, getFamilyName, fmtAmt, userId, tripId, onRefresh }: SettleTabProps) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const isFamilyTrip = trip.tripType === "family" && trip.families && trip.families.length > 0;

  async function toggleSettle(from: string, to: string) {
    const key = `${from}__${to}`;
    setLoadingKey(key);
    await new Promise((r) => setTimeout(r, 200));
    
    if (isSettled(trip, from, to)) {
      unmarkSettled(userId, tripId, from, to);
    } else {
      markSettled(userId, tripId, from, to);
    }
    onRefresh();
    setLoadingKey(null);
  }

  if (settlements.length === 0) {
    return <EmptyState icon="🎉" title="All settled up!" sub="Everyone is perfectly even. No payments are pending." />;
  }

  const pending = settlements.filter((s) => !isSettled(trip, s.from, s.to));
  const settled = settlements.filter((s) => isSettled(trip, s.from, s.to));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-500 py-3 px-4 bg-gray-50 border border-gray-200/80 rounded-xl leading-relaxed">
        <strong>💸 Repayment List:</strong> Click "Mark Settled" once you send standard cash/wire payments. This updates the totals instantly.
      </p>

      {/* Pending Settlement Row */}
      {pending.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-3">Pending Settlements</h4>
          <div className="flex flex-col gap-3">
            {pending.map((s) => {
              const key = `${s.from}__${s.to}`;
              const busy = loadingKey === key;
              return (
                <div key={key} className="bg-white border border-gray-200 hover:border-emerald-300 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-5 transition-all shadow-xs">
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-8.5 h-8.5 rounded-full bg-red-50 text-red-600 font-bold text-[12px] flex items-center justify-center shrink-0 uppercase border border-red-100">
                      {getMemberName(s.from)[0]}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-950">{getMemberName(s.from)}</span>
                      {isFamilyTrip && getFamilyName(s.from) && (
                        <span className="text-[10px] text-purple-600 font-medium">{getFamilyName(s.from)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">pays</span>
                    <span className="font-serif text-[17px] font-bold text-gray-950">{fmtAmt(s.amount)}</span>
                    <div className="w-16 h-0.5 bg-gray-100 relative mt-1.5">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-300">➜</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-gray-950">{getMemberName(s.to)}</span>
                        {isFamilyTrip && getFamilyName(s.to) && (
                          <span className="text-[10px] text-purple-600 font-medium">{getFamilyName(s.to)}</span>
                        )}
                      </div>
                      <div className="w-8.5 h-8.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[12px] flex items-center justify-center shrink-0 uppercase border border-emerald-100">
                        {getMemberName(s.to)[0]}
                      </div>
                    </div>

                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1ec88f] hover:bg-[#17a876] text-white rounded-lg text-xs font-bold transition-all disabled:opacity-60 cursor-pointer shadow-xs active:scale-[0.98]"
                      onClick={() => toggleSettle(s.from, s.to)}
                      disabled={busy}
                    >
                      {busy ? (
                        <span className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={13} />
                          <span>Mark Settled</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settled Row */}
      {settled.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-3">Settled ✓</h4>
          <div className="flex flex-col gap-3">
            {settled.map((s) => {
              const key = `${s.from}__${s.to}`;
              const busy = loadingKey === key;
              return (
                <div key={key} className="bg-emerald-50/40 border border-emerald-100/70 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-5 transition-all opacity-85">
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-8.5 h-8.5 rounded-full bg-gray-150 text-gray-400 font-bold text-[12px] flex items-center justify-center shrink-0 uppercase border border-gray-200">
                      {getMemberName(s.from)[0]}
                    </div>
                    <span className="font-semibold text-gray-400 line-through">{getMemberName(s.from)}</span>
                  </div>

                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-gray-450 uppercase tracking-wilder mb-0.5">paid</span>
                    <span className="font-serif text-sm font-bold text-gray-450 line-through">{fmtAmt(s.amount)}</span>
                    <CheckCircle2 size={15} className="text-[#1ec88f] mt-1" />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-400 line-through">{getMemberName(s.to)}</span>
                      <div className="w-8.5 h-8.5 rounded-full bg-gray-150 text-gray-400 font-bold text-[12px] flex items-center justify-center shrink-0 uppercase border border-gray-200">
                        {getMemberName(s.to)[0]}
                      </div>
                    </div>

                    <button
                      className="inline-flex items-center gap-1 px-2.5 py-1.2 border border-gray-200 text-gray-500 hover:text-red-500 hover:bg-red-50 hover:border-red-100 rounded-lg text-xs font-bold transition-all disabled:opacity-60 cursor-pointer"
                      onClick={() => toggleSettle(s.from, s.to)}
                      disabled={busy}
                    >
                      {busy ? (
                        <span className="w-4 h-4 border-2 border-emerald-800/20 border-t-emerald-800 rounded-full animate-spin" />
                      ) : (
                        <>
                          <RotateCcw size={12} />
                          <span>Undo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Members Tab Component ────────────────────────────────────────────────────
interface MembersTabProps {
  trip: Trip;
  balances: Record<string, number>;
  fmtAmt: (n: number) => string;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

function MembersTab({ trip, balances, fmtAmt, onAdd, onDelete }: MembersTabProps) {
  const totalSpent = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const fairShare = totalSpent / (trip.members.length || 1);
  const isFamilyTrip = trip.tripType === "family" && trip.families && trip.families.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between pb-1 border-b border-gray-100">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {isFamilyTrip 
            ? `${trip.families.length} Families · ${trip.members.length} Members`
            : `${trip.members.length} Traveler${trip.members.length !== 1 ? "s" : ""}`
          }
        </span>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1ec88f]/20 bg-emerald-50 text-emerald-700 hover:bg-[#1ec88f] hover:text-white rounded-lg text-xs font-bold transition-all"
          onClick={onAdd}
        >
          <UserPlus size={13} />
          <span>Add Member</span>
        </button>
      </div>

      {trip.members.length === 0 ? (
        <EmptyState icon="👥" title="No members added" sub="Ensure travelers are added to calculate the split stats.">
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-3 py-1.5 border border-[#1ec88f]/20 bg-emerald-50 text-[#1ec88f] hover:bg-[#1ec88f] hover:text-white rounded-lg text-xs font-bold transition-colors mt-2"
          >
            <UserPlus size={13} />
            <span>Add Member</span>
          </button>
        </EmptyState>
      ) : isFamilyTrip ? (
        // Family-grouped view
        <div className="flex flex-col gap-6">
          {trip.families.map((family) => {
            const familyMembers = trip.members.filter((m) => family.members.includes(m.id));
            const payer = familyMembers.find((m) => m.id === family.payerId);
            
            return (
              <div key={family.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 pb-2 border-b border-purple-100">
                  <Home size={16} className="text-purple-600" />
                  <span className="font-serif text-sm font-bold text-gray-900">{family.name}</span>
                  {payer && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Crown size={10} className="text-amber-500" />
                      Payer: {payer.name}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {familyMembers.map((member) => {
                    const bal = balances[member.id] || 0;
                    const paid = trip.expenses
                      .flatMap((e) => e.paidBy || [])
                      .filter((p) => p.memberId === member.id)
                      .reduce((s, p) => s + p.amount, 0);
                    
                    const pos = bal >= 0;
                    const settled = Math.abs(bal) < 0.01;
                    const isPayer = member.id === family.payerId;

                    return (
                      <div key={member.id} className={`bg-white border rounded-xl p-4 flex flex-col gap-3 ${
                        isPayer ? "border-amber-200 bg-amber-50/30" : "border-gray-150"
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-9 h-9 rounded-full border font-extrabold text-xs flex items-center justify-center shrink-0 uppercase select-none ${
                              isPayer 
                                ? "bg-amber-50 border-amber-200 text-amber-700"
                                : "bg-emerald-50 border-emerald-100 text-emerald-700"
                            }`}>
                              {member.name[0]}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-serif text-sm font-bold text-gray-900 truncate">{member.name}</span>
                                {isPayer && <Crown size={12} className="text-amber-500 shrink-0" />}
                              </div>
                              <span className={`text-xs font-bold ${settled ? "text-gray-400" : pos ? "text-emerald-600" : "text-red-500"}`}>
                                {settled ? "Settled" : pos ? `Gets back ${fmtAmt(bal)}` : `Owes ${fmtAmt(Math.abs(bal))}`}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => onDelete(member.id)}
                            className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg shrink-0 transition-colors"
                            title="Remove member"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div className="flex flex-col gap-1.5 border-t border-gray-50 pt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Paid</span>
                            <span className="font-serif font-bold text-gray-900">{fmtAmt(paid)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Share</span>
                            <span className="font-serif font-bold text-gray-900">{fmtAmt(fairShare)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Regular flat view for friends/solo trips
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trip.members.map((member) => {
            const bal = balances[member.id] || 0;
            const paid = trip.expenses
              .flatMap((e) => e.paidBy || [])
              .filter((p) => p.memberId === member.id)
              .reduce((s, p) => s + p.amount, 0);
              
            const pos = bal >= 0;
            const settled = Math.abs(bal) < 0.01;

            return (
              <div key={member.id} className="bg-white border border-gray-150 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-extrabold text-sm flex items-center justify-center shrink-0 uppercase select-none">
                      {member.name[0]}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-serif text-sm font-bold text-gray-900 truncate">{member.name}</span>
                      <span className={`text-xs font-bold ${settled ? "text-gray-400" : pos ? "text-emerald-600" : "text-red-500"}`}>
                        {settled ? "Settled" : pos ? `Gets back ${fmtAmt(bal)}` : `Owes ${fmtAmt(Math.abs(bal))}`}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDelete(member.id)}
                    className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg shrink-0 transition-colors"
                    title="Remove member"
                    aria-label="Remove member"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="flex flex-col gap-2 border-t border-gray-50 pt-3">
                  <div className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Total Paid</span>
                    <span className="font-serif font-bold text-gray-900" title={fmtAmt(paid)}>{fmtAmt(paid)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Fair Share</span>
                    <span className="font-serif font-bold text-gray-900" title={fmtAmt(fairShare)}>{fmtAmt(fairShare)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Net Balance</span>
                    <span className={`font-serif font-bold ${settled ? "text-gray-400" : pos ? "text-emerald-600" : "text-red-500"}`} title={fmtAmt(Math.abs(bal))}>
                      {settled ? "—" : `${pos ? "+" : "-"}${fmtAmt(Math.abs(bal))}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Share & Export Modal Component ───────────────────────────────────────────
interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  getMemberName: (id: string) => string;
  balances: Record<string, number>;
  settlements: Settlement[];
}

function ShareModal({ open, onClose, trip, getMemberName, balances, settlements }: ShareModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function exportPDF() {
    setLoading("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const brandRGB = [30, 200, 143];

      // Styled Header Band
      doc.setFillColor(brandRGB[0], brandRGB[1], brandRGB[2]);
      doc.rect(0, 0, 210, 28, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("SplitTrack — Personal Trip Report", 14, 12);
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(trip.name, 14, 20);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}`, 14, 26);

      // Section: Trip Summary Metrics
      const spendTotal = trip.expenses.reduce((s, e) => s + e.amount, 0);
      const avgSpent = spendTotal / (trip.members.length || 1);
      const numMembers = trip.members.length;
      const numExpenses = trip.expenses.length;

      let y = 36;
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Trip Summary", 14, y);
      y += 5;

      // Draw Summary Cards
      const cardW = 42;
      const cardH = 18;
      const gap = 4.6;
      const metrics = [
        { label: "Total Cost", val: `${trip.currency} ${spendTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { label: "Cost Per Person", val: `${trip.currency} ${avgSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { label: "Members Involved", val: `${numMembers}` },
        { label: "Total Transactions", val: `${numExpenses}` },
      ];

      metrics.forEach((m, idx) => {
        const cx = 14 + idx * (cardW + gap);
        doc.setFillColor(248, 250, 252); 
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cx, y, cardW, cardH, 2, 2, "FD");

        // Label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(m.label, cx + 3, y + 6);

        // Value
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42); 
        doc.text(m.val, cx + 3, y + 13);
      });

      y += cardH + 10;

      // Section: Expenses
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Trip Expenses", 14, y);
      y += 5;

      const expData = trip.expenses.map((e) => [
        fmtDate(e.date),
        e.description,
        getCat(e.category, DEFAULT_CATEGORIES).label.replace(/^\S+\s/, ""),
        (e.paidBy || []).map((p) => `${getMemberName(p.memberId)} (${trip.currency} ${p.amount.toFixed(2)})`).join(", "),
        e.splitAmong.length === trip.members.length ? "Everyone" : e.splitAmong.map((id) => getMemberName(id)).join(", "),
        `${trip.currency} ${e.amount.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Date", "Description", "Category", "Paid by", "Splits", "Amount"]],
        body: expData,
        headStyles: { fillColor: brandRGB as any, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 252, 250] },
        styles: { fontSize: 8, cellPadding: 2.2 },
        margin: { left: 14, right: 14 },
      });

      // Section: Net Balances Breakdowns
      y = (doc as any).lastAutoTable.finalY + 12;
      const pageHeight = doc.internal.pageSize.height;
      if (y > pageHeight - 45) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Individual Balances", 14, y);
      y += 5;

      const balData = trip.members.map((m) => {
        const paid = trip.expenses
          .filter((e) => e.paidBy?.some((p) => p.memberId === m.id))
          .reduce((s, e) => s + (e.paidBy?.find((p) => p.memberId === m.id)?.amount || 0), 0);

        const fairShare = trip.expenses
          .filter((e) => e.splitAmong.includes(m.id))
          .map((e) => e.amount / (e.splitAmong.length || 1))
          .reduce((s, v) => s + v, 0);

        const bal = paid - fairShare;
        return [
          m.name,
          `${trip.currency} ${paid.toFixed(2)}`,
          `${trip.currency} ${fairShare.toFixed(2)}`,
          Math.abs(bal) < 0.01 ? "Settled" : bal >= 0 ? "Gets back" : "Owes",
          `${bal >= 0 ? "+" : ""}${trip.currency} ${bal.toFixed(2)}`,
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Member", "Total Paid", "Fair Share", "Net Direction", "Final Balance"]],
        body: balData,
        headStyles: { fillColor: brandRGB as any, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 252, 250] },
        styles: { fontSize: 8.5, cellPadding: 2.2 },
        margin: { left: 14, right: 14 },
      });

      // Section: Settlement Instructions (Settle Up Path)
      y = (doc as any).lastAutoTable.finalY + 12;
      if (y > pageHeight - 45) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Settlement Instructions", 14, y);
      y += 5;

      const settleData = settlements.length > 0
        ? settlements.map((s) => {
            const pathSettled = isSettled(trip, s.from, s.to);
            return [
              getMemberName(s.from),
              getMemberName(s.to),
              `${trip.currency} ${s.amount.toFixed(2)}`,
              pathSettled ? "Settled (Paid)" : "Pending Settlement",
            ];
          })
        : [["—", "All settled up!", "—", "—"]];

      autoTable(doc, {
        startY: y,
        head: [["Payer (From)", "Receiver (To)", "Amount", "Status"]],
        body: settleData,
        headStyles: { fillColor: brandRGB as any, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 252, 250] },
        styles: { fontSize: 8.5, cellPadding: 2.2 },
        margin: { left: 14, right: 14 },
      });

      doc.save(`${trip.name.replace(/\s+/g, "_")}_Expense_Report.pdf`);
      setDone("pdf");
    } catch (err) {
      console.error(err);
      alert("PDF exporting failed. Try again.");
    }
    setLoading(null);
  }

  async function exportExcel() {
    setLoading("excel");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Expenses Sheet
      const expRows = trip.expenses.map((e) => ({
        Date: e.date,
        Description: e.description,
        Category: getCat(e.category, DEFAULT_CATEGORIES).label.replace(/^\S+\s/, ""),
        "Paid by": (e.paidBy || []).map((p) => `${getMemberName(p.memberId)} (${trip.currency} ${p.amount.toFixed(2)})`).join("; "),
        "Split among": e.splitAmong.map((id) => getMemberName(id)).join(", "),
        Amount: e.amount,
        Currency: trip.currency,
      }));
      const ws1 = XLSX.utils.json_to_sheet(expRows);
      ws1["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 15 }, { wch: 30 }, { wch: 24 }, { wch: 10 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Expenses");

      // Sheet 2: Balances Sheet
      const balRows = trip.members.map((m) => {
        const bal = balances[m.id] || 0;
        return {
          Member: m.name,
          Balance: bal.toFixed(2),
          Currency: trip.currency,
          Status: Math.abs(bal) < 0.01 ? "Settled" : bal >= 0 ? "Gets back" : "Owes",
        };
      });
      const ws2 = XLSX.utils.json_to_sheet(balRows);
      ws2["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Balances");

      // Sheet 3: Settlement Summary
      const setRows = settlements.length > 0
        ? settlements.map((s) => ({ From: getMemberName(s.from), To: getMemberName(s.to), Amount: s.amount.toFixed(2), Currency: trip.currency }))
        : [{ From: "—", To: "All settled up!", Amount: "0.00", Currency: trip.currency }];
      const ws3 = XLSX.utils.json_to_sheet(setRows);
      ws3["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Settle Up");

      // Sheet 4: Configuration Summary
      const sumRows = [
        { Metric: "Trip Title", Detail: trip.name },
        { Metric: "Description", Detail: trip.description || "N/A" },
        { Metric: "All member roster", Detail: trip.members.map((m) => m.name).join(", ") },
        { Metric: "Total Spent", Detail: trip.expenses.reduce((s, e) => s + e.amount, 0).toFixed(2) },
        { Metric: "Average Spent", Detail: (trip.expenses.reduce((s, e) => s + e.amount, 0) / (trip.members.length || 1)).toFixed(2) },
        { Metric: "Generated On", Detail: new Date().toISOString() },
      ];
      const ws4 = XLSX.utils.json_to_sheet(sumRows);
      ws4["!cols"] = [{ wch: 18 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(wb, ws4, "Summary");

      XLSX.writeFile(wb, `${trip.name.replace(/\s+/g, "_")}_SplitTrack.xlsx`);
      setDone("excel");
    } catch (err) {
      console.error(err);
      alert("Excel export failed.");
    }
    setLoading(null);
  }

  function exportCSV() {
    setLoading("csv");
    try {
      const rows = [
        ["Date", "Description", "Category", "Paid by", "Split among", "Amount", "Currency"],
        ...trip.expenses.map((e) => [
          e.date,
          `"${e.description.replace(/"/g, '""')}"`,
          getCat(e.category, DEFAULT_CATEGORIES).label.replace(/^\S+\s/, ""),
          `"${(e.paidBy || []).map((p) => `${getMemberName(p.memberId)} (${trip.currency} ${p.amount.toFixed(2)})`).join("; ")}"`,
          `"${e.splitAmong.map((id) => getMemberName(id)).join(", ")}"`,
          e.amount.toFixed(2),
          trip.currency,
        ]),
      ];
      const csv = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${trip.name.replace(/\s+/g, "_")}_SplitTrack.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDone("csv");
    } catch (err) {
      console.error(err);
      alert("Failed to export CSV.");
    }
    setLoading(null);
  }

  const spendtotal = trip.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <Modal open={open} onClose={onClose} title="Share Trip" size="md">
      <div className="flex flex-col gap-5">
        <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl leading-snug">
          <div className="font-serif font-bold text-gray-900 text-lg mb-1">{trip.name}</div>
          <div className="text-xs text-gray-400 font-medium">
            {trip.members.length} members · {trip.expenses.length} expenses · {trip.currency} {spendtotal.toLocaleString()} total
          </div>
        </div>

        <p className="text-sm text-gray-500">
          Download our highly polished summaries of all expenses, balances, and settle-up paths.
        </p>

        <div className="flex flex-col gap-3">
          {[
            {
              id: "pdf",
              label: "PDF Report",
              desc: "Polished documents with dynamic expenses and balances table",
              color: "text-red-650 bg-red-50 hover:bg-red-100/50 hover:border-red-200",
              action: exportPDF,
              icon: <FileText size={20} className="text-red-500" />
            },
            {
              id: "excel",
              label: "Excel Spreadsheet",
              desc: "Provides 4 detailed Sheets for full analytical auditing",
              color: "text-green-650 bg-green-50 hover:bg-[#f0fdf4] hover:border-green-200",
              action: exportExcel,
              icon: <Table size={20} className="text-emerald-600" />
            },
            {
              id: "csv",
              label: "CSV File",
              desc: "Standard CSV sheets compatible with any data platform",
              color: "text-blue-650 bg-blue-50 hover:bg-blue-50/50 hover:border-blue-200",
              action: exportCSV,
              icon: <FileCode size={20} className="text-blue-500" />
            }
          ].map((opt) => (
            <div
              key={opt.id}
              className={`flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-emerald-500/50 transition-all select-none hover:shadow-sm`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-50 shadow-xs shrink-0">{opt.icon}</div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-400 font-medium truncate max-w-xs">{opt.desc}</div>
                </div>
              </div>

              <button
                onClick={opt.action}
                disabled={!!loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold text-xs rounded-lg transition-colors cursor-pointer ${
                  done === opt.id
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {loading === opt.id ? (
                  <span className="w-4 h-4 border-2 border-emerald-800/10 border-t-emerald-800 rounded-full animate-spin shrink-0" />
                ) : done === opt.id ? (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Downloaded</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span>Get File</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100 mt-2">
          <button
            className="px-4 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 text-sm font-semibold rounded-lg transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Expense Modal Component (Add / Edit) ─────────────────────────────────────
interface ExpenseModalProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  expense: Expense | null;
  onSaved: () => void;
  userId: string;
  tripId: string;
  categories: any[];
  onAddCategory: (category: any) => void;
}

function ExpenseModal({ open, onClose, trip, expense, onSaved, userId, tripId, categories, onAddCategory }: ExpenseModalProps) {
  const isEdit = !!expense;
  
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [paidByMode, setPaidByMode] = useState<"single" | "combined">("single");
  const [singlePayer, setSinglePayer] = useState("");
  const [combinedPayers, setCombinedPayers] = useState<Record<string, string>>({});
  const [splitAmong, setSplitAmong] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [customCategoryEmoji, setCustomCategoryEmoji] = useState("");
  const [customCategoryColor, setCustomCategoryColor] = useState("#6366f1");

  useEffect(() => {
    if (!open) return;
    if (isEdit && expense) {
      const paidBy = expense.paidBy || [];
      const hasCombinedPayers = paidBy.length > 1;
      
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setCategory(expense.category);
      setPaidByMode(hasCombinedPayers ? "combined" : "single");
      
      if (hasCombinedPayers) {
        setSinglePayer(trip.members[0]?.id || "");
        const cpMap: Record<string, string> = {};
        paidBy.forEach((p) => {
          cpMap[p.memberId] = p.amount.toString();
        });
        setCombinedPayers(cpMap);
      } else {
        setSinglePayer(paidBy[0]?.memberId || trip.members[0]?.id || "");
        setCombinedPayers({});
      }
      
      setSplitAmong(expense.splitAmong);
      setDate(expense.date);
    } else {
      setDescription("");
      setAmount("");
      setCategory("food");
      setPaidByMode("single");
      setSinglePayer(trip.members[0]?.id || "");
      setCombinedPayers({});
      setSplitAmong(trip.members.map((m) => m.id));
      setDate(new Date().toISOString().split("T")[0]);
    }
    setErrors({});
  }, [open, expense, isEdit, trip?.members]);

  function getCombinedPayersList(): PayerContribution[] {
    if (paidByMode === "single") {
      return [{ memberId: singlePayer, amount: parseFloat(amount) || 0 }];
    }
    return Object.entries(combinedPayers)
      .filter(([_, v]) => (v as string).trim() && parseFloat(v as string) > 0)
      .map(([id, v]) => ({ memberId: id, amount: parseFloat(v as string) }));
  }

  const computedCombinedSum = () =>
    Object.entries(combinedPayers)
      .filter(([_, v]) => (v as string).trim() && parseFloat(v as string) > 0)
      .reduce((s, [_, v]) => s + (parseFloat(v as string) || 0), 0);

  function autoDistributeEqually() {
    const activeMembers = Object.keys(combinedPayers);
    if (activeMembers.length === 0) return;
    const share = (parseFloat(amount) || 0) / activeMembers.length;
    const nextMap: Record<string, string> = {};
    activeMembers.forEach((id) => {
      nextMap[id] = share.toFixed(2);
    });
    setCombinedPayers(nextMap);
  }

  function toggleCombined(id: string) {
    const copy = { ...combinedPayers };
    if (copy[id] !== undefined) {
      delete copy[id];
    } else {
      copy[id] = "";
    }
    setCombinedPayers(copy);
    setErrors((e) => ({ ...e, paidBy: "" }));
  }

  function setCombinedAmt(id: string, val: string) {
    setCombinedPayers((cp) => ({ ...cp, [id]: val }));
    setErrors((e) => ({ ...e, paidBy: "" }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!description.trim()) errs.description = "Expense title is required";
    
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      errs.amount = "Enter a valid cost amount";
    }
    
    if (paidByMode === "single" && !singlePayer) {
      errs.paidBy = "Select which group member paid";
    }
    
    if (paidByMode === "combined") {
      const payers = buildPaidBy();
      if (payers.length < 2) {
        errs.paidBy = "Select at least 2 payers in Combined mode";
      } else {
        const sum = payers.reduce((s, p) => s + p.amount, 0);
        if (Math.abs(sum - amt) > 0.01) {
          errs.paidBy = `Sub-contributions must sum to ${trip.currency} ${amt.toFixed(2)} (currently sum is ${trip.currency} ${sum.toFixed(2)})`;
        }
      }
    }
    
    if (splitAmong.length === 0) {
      errs.split = "Select at least 1 person to split among";
    }
    return errs;
  }

  function buildPaidBy() {
    if (paidByMode === "single") {
      return [{ memberId: singlePayer, amount: parseFloat(amount) || 0 }];
    }
    return Object.entries(combinedPayers)
      .filter(([_, v]) => (v as string).trim() && parseFloat(v as string) > 0)
      .map(([id, v]) => ({ memberId: id, amount: parseFloat(v as string) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 250));
    
    const payload = {
      description: description.trim(),
      amount: parseFloat(amount),
      category,
      paidBy: buildPaidBy(),
      splitAmong,
      date,
      receipt: null,
    };

    if (isEdit && expense) {
      updateExpense(userId, tripId, expense.id, payload);
    } else {
      addExpense(userId, tripId, payload);
    }
    
    setSaving(false);
    onSaved();
  }

  function toggleSplit(id: string) {
    setSplitAmong((sm) =>
      sm.includes(id) ? sm.filter((x) => x !== id) : [...sm, id]
    );
    setErrors((e) => ({ ...e, split: "" }));
  }

  const parsedTotal = parseFloat(amount) || 0;
  const comboSum = computedCombinedSum();
  const comboOk = Math.abs(comboSum - parsedTotal) < 0.01 && Object.keys(combinedPayers).length >= 2;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Expense" : "Add Expense"} size="lg">
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-5">
          
          {/* Description */}
          <div className="flex flex-col gap-1.25">
            <label className="text-xs font-semibold text-gray-700">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 transition-all ${
                errors.description ? "border-red-400 focus:border-red-400" : "border-gray-200"
              }`}
              placeholder="e.g. Dinner at Sushi restaurant"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors((e) => ({ ...e, description: "" }));
              }}
              autoFocus
            />
            {errors.description && <span className="text-xs text-red-500 font-medium">{errors.description}</span>}
          </div>

          {/* Amount + Category Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.25">
              <label className="text-xs font-semibold text-gray-700">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-bold text-gray-400">{trip?.currency}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`w-full pl-12 pr-4 py-2.5 border rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 transition-all ${
                    errors.amount ? "border-red-400 focus:border-red-400" : "border-gray-200"
                  }`}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setErrors((e) => ({ ...e, amount: "" }));
                  }}
                />
              </div>
              {errors.amount && <span className="text-xs text-red-500 font-medium">{errors.amount}</span>}
            </div>

            <div className="flex flex-col gap-1.25">
              <label className="text-xs font-semibold text-gray-700">Category</label>
              {!showCustomCategory ? (
                <>
                  <select
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] outline-none cursor-pointer"
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setShowCustomCategory(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                    <option value="__custom__">+ Add Custom Category</option>
                  </select>
                </>
              ) : (
                <div className="flex flex-col gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">Create Custom Category</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomCategory(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Category name (e.g., Entertainment)"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Emoji (optional)"
                      value={customCategoryEmoji}
                      onChange={(e) => setCustomCategoryEmoji(e.target.value)}
                      maxLength={2}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] outline-none"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {["#8B5CF6", "#F59E0B", "#3B82F6", "#EC4899", "#14B8A6", "#EF4444", "#10B981", "#F97316"].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setCustomCategoryColor(color)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            customCategoryColor === color ? "border-gray-900 scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customCategoryName.trim()) return;
                      const value = customCategoryName.trim().toLowerCase().replace(/\s+/g, "_");
                      const label = `${customCategoryEmoji || "📌"} ${customCategoryName.trim()}`;
                      const newCategory = { value, label, color: customCategoryColor };
                      onAddCategory(newCategory);
                      setCategory(value);
                      setShowCustomCategory(false);
                      setCustomCategoryName("");
                      setCustomCategoryEmoji("");
                      setCustomCategoryColor("#6366f1");
                    }}
                    disabled={!customCategoryName.trim()}
                    className="px-3 py-1.5 bg-[#1ec88f] text-white rounded-lg text-xs font-bold hover:bg-[#17a876] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add & Select
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.25">
            <label className="text-xs font-semibold text-gray-700">Date</label>
            <input
              type="date"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] transition-all"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Paid By Mode selector */}
          <div className="flex flex-col gap-1.5 border border-gray-100 p-4 rounded-xl bg-gray-50/20">
            <label className="text-xs font-bold text-gray-600 mb-1 leading-none">
              Paid by <span className="text-red-500">*</span>
            </label>
            
            <div className="flex p-1 bg-gray-100 border border-gray-100 rounded-xl mb-3">
              <button
                type="button"
                className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all ${
                  paidByMode === "single"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                onClick={() => setPaidByMode("single")}
              >
                Single payer
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all ${
                  paidByMode === "combined"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
                onClick={() => setPaidByMode("combined")}
              >
                Combined payers
              </button>
            </div>

            {paidByMode === "single" ? (
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] outline-none cursor-pointer"
                value={singlePayer}
                onChange={(e) => {
                  setSinglePayer(e.target.value);
                  setErrors((ex) => ({ ...ex, paidBy: "" }));
                }}
              >
                {trip?.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex flex-col gap-3 p-4 bg-gray-100 border border-gray-200 rounded-xl">
                <div className="flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-1.5 border-b border-gray-200/80 pb-2">
                  <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                    Check group contributors
                  </span>
                  <button
                    type="button"
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
                    onClick={autoDistributeEqually}
                  >
                    Auto-distribute equally
                  </button>
                </div>
                
                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {trip?.members.map((m) => {
                    const checked = combinedPayers[m.id] !== undefined;
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                          checked ? "border-[#1ec88f]/50 bg-emerald-50/50" : "border-transparent bg-white/70"
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1 select-none">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded-sm text-emerald-500 accent-[#1ec88f]"
                            checked={checked}
                            onChange={() => toggleCombined(m.id)}
                          />
                          <div className="w-6.5 h-6.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0 uppercase">
                            {m.name[0]}
                          </div>
                          <span className="text-xs font-bold text-gray-900">{m.name}</span>
                        </label>
                        
                        {checked && (
                          <div className="relative flex items-center w-28 shrink-0">
                            <span className="absolute left-2.5 text-[10px] font-bold text-gray-400">{trip?.currency}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full pl-7 pr-2 py-1 border border-gray-250 rounded-md text-xs bg-white text-gray-950 font-semibold focus:border-[#1ec88f] outline-none"
                              placeholder="0.00"
                              value={combinedPayers[m.id]}
                              onChange={(e) => setCombinedAmt(m.id, e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {Object.keys(combinedPayers).length >= 2 && parsedTotal > 0 && (
                  <div className={`text-center py-2 px-3.5 rounded-md text-xs font-bold border transition-colors ${
                    comboOk ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-500"
                  }`}>
                    {comboOk
                      ? `✓ sum details match total (${trip?.currency} ${parsedTotal.toFixed(2)})`
                      : `✗ Sum of contributor entries (${trip?.currency} ${comboSum.toFixed(2)}) must sum to total amount (${trip?.currency} ${parsedTotal.toFixed(2)})`}
                  </div>
                )}
              </div>
            )}
            {errors.paidBy && <span className="text-xs text-red-500 font-medium">{errors.paidBy}</span>}
          </div>

          {/* Split among list chips */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Split among <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-full text-xs font-bold border border-gray-250 hover:border-[#1ec88f] transition-all bg-gray-50 text-gray-700`}
                onClick={() => setSplitAmong(trip?.members.map((m) => m.id) || [])}
              >
                Everyone
              </button>
              {trip?.members.map((m) => {
                const on = splitAmong.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      on
                        ? "bg-[#1ec88f] border-[#1ec88f] text-white font-bold"
                        : "bg-white border-gray-200 text-gray-600 hover:border-emerald-500"
                    }`}
                    onClick={() => toggleSplit(m.id)}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
            {errors.split && <span className="text-xs text-red-500 font-medium block mt-1">{errors.split}</span>}
            {splitAmong.length > 0 && parsedTotal > 0 && (
              <span className="text-xs text-gray-400 font-semibold mt-1">
                {trip?.currency} {(parsedTotal / splitAmong.length).toFixed(2)} per split traveler
              </span>
            )}
          </div>

        </div>

        <div className="flex justify-end gap-3 pt-5 border-t border-gray-100 mt-6 flex-shrink-0">
          <button
            type="button"
            className="px-4 py-2 border border-gray-250 text-gray-500 hover:bg-gray-50 font-semibold text-sm rounded-lg transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#1ec88f] hover:bg-[#17a876] text-white rounded-lg text-sm font-bold flex items-center justify-center transition-colors min-w-[125px]"
            disabled={saving}
          >
            {saving ? (
              <span className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Add Expense"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Add Member Modal Component ───────────────────────────────────────────────
interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  tripId: string;
  onSaved: () => void;
}

function AddMemberModal({ open, onClose, userId, tripId, onSaved }: AddMemberModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 200));
    addMember(userId, tripId, name.trim());
    setSaving(false);
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Member" size="sm">
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700">Member name</label>
            <input
              className={`w-full px-4 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] outline-none transition-all ${
                error ? "border-red-400" : "border-gray-200"
              }`}
              placeholder="e.g. David"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              autoFocus
            />
            {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              className="px-4 py-2 border border-gray-250 text-gray-500 hover:bg-gray-50 text-sm font-semibold rounded-lg transition-colors shadow-xs"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#1ec88f] hover:bg-[#17a876] text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center min-w-[100px]"
              disabled={saving}
            >
              {saving ? (
                <span className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
              ) : (
                "Add Member"
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── Families Tab Component ───────────────────────────────────────────────────
interface FamiliesTabProps {
  trip: Trip;
  balances: Record<string, number>;
  fmtAmt: (n: number) => string;
  onAddFamily: () => void;
  onDeleteFamily: (id: string) => void;
  onChangePayer: (familyId: string, newPayerId: string) => void;
  getMemberName: (id: string) => string;
}

function FamiliesTab({ trip, balances, fmtAmt, onAddFamily, onDeleteFamily, onChangePayer, getMemberName }: FamiliesTabProps) {
  const families = trip.families || [];

  if (families.length === 0) {
    return (
      <EmptyState icon="👨‍👩‍👧‍👦" title="No families added" sub="Add families to organize members and designate payers.">
        <button
          onClick={onAddFamily}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1ec88f] hover:bg-[#17a876] text-white rounded-lg text-sm font-semibold transition-colors mt-2"
        >
          <Plus size={14} />
          <span>Add Family</span>
        </button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between pb-1 border-b border-gray-100">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {families.length} {families.length === 1 ? "Family" : "Families"}
        </span>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1ec88f]/20 bg-emerald-50 text-emerald-700 hover:bg-[#1ec88f] hover:text-white rounded-lg text-xs font-bold transition-all"
          onClick={onAddFamily}
        >
          <Plus size={13} />
          <span>Add Family</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {families.map((family) => {
          const familyMembers = trip.members.filter((m) => family.members.includes(m.id));
          const payer = familyMembers.find((m) => m.id === family.payerId);
          const familyTotalPaid = trip.expenses
            .flatMap((e) => e.paidBy || [])
            .filter((p) => familyMembers.some((m) => m.id === p.memberId))
            .reduce((s, p) => s + p.amount, 0);
          const familyTotalOwes = trip.expenses
            .filter((e) => familyMembers.some((m) => e.splitAmong.includes(m.id)))
            .reduce((s, e) => {
              const familyShare = familyMembers.filter((m) => e.splitAmong.includes(m.id)).length;
              return s + (e.amount / (e.splitAmong.length || 1)) * familyShare;
            }, 0);
          const familyBalance = familyTotalPaid - familyTotalOwes;

          return (
            <div key={family.id} className="bg-white border border-gray-150 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-purple-50 border border-purple-100 text-purple-700 font-extrabold text-sm flex items-center justify-center shrink-0">
                    <Home size={18} />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-serif text-sm font-bold text-gray-900 truncate">{family.name}</span>
                    <span className="text-xs text-gray-500">{familyMembers.length} members</span>
                  </div>
                </div>
                <button
                  onClick={() => onDeleteFamily(family.id)}
                  className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg shrink-0 transition-colors"
                  title="Remove family"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Payer Selection */}
              <div className="flex flex-col gap-1.5 border-t border-gray-50 pt-3">
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                  <Crown size={12} className="text-amber-500" />
                  Designated Payer
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-900 focus:border-[#1ec88f] outline-none cursor-pointer"
                  value={family.payerId}
                  onChange={(e) => onChangePayer(family.id, e.target.value)}
                >
                  {familyMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {payer && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    {payer.name} pays for this family's expenses
                  </span>
                )}
              </div>

              {/* Members List */}
              <div className="flex flex-col gap-1.5 border-t border-gray-50 pt-3">
                <span className="text-xs font-semibold text-gray-600">Members</span>
                <div className="flex flex-wrap gap-1.5">
                  {familyMembers.map((m) => (
                    <span
                      key={m.id}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                        m.id === family.payerId
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-gray-50 text-gray-700 border border-gray-200"
                      }`}
                    >
                      {m.id === family.payerId && <Crown size={10} />}
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Family Balance Summary */}
              <div className="flex flex-col gap-2 border-t border-gray-50 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Total Paid</span>
                  <span className="font-serif font-bold text-gray-900">{fmtAmt(familyTotalPaid)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Total Share</span>
                  <span className="font-serif font-bold text-gray-900">{fmtAmt(familyTotalOwes)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Net Balance</span>
                  <span className={`font-serif font-bold ${
                    Math.abs(familyBalance) < 0.01 ? "text-gray-400" : familyBalance >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}>
                    {Math.abs(familyBalance) < 0.01 ? "—" : `${familyBalance >= 0 ? "+" : "-"}${fmtAmt(Math.abs(familyBalance))}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Add Family Modal Component ───────────────────────────────────────────────
interface AddFamilyModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (data: { name: string; memberNames: string[]; payerName: string }) => void;
}

function AddFamilyModal({ open, onClose, onSaved }: AddFamilyModalProps) {
  const [name, setName] = useState("");
  const [memberNames, setMemberNames] = useState(["", ""]);
  const [payerName, setPayerName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setMemberNames(["", ""]);
      setPayerName("");
      setErrors({});
    }
  }, [open]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Family name is required";
    const validMembers = memberNames.filter((m) => m.trim());
    if (validMembers.length < 1) errs.members = "Add at least 1 member";
    if (!payerName.trim()) errs.payer = "Select a payer";
    else if (!validMembers.includes(payerName)) errs.payer = "Payer must be a family member";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 200));
    onSaved({
      name: name.trim(),
      memberNames: memberNames.filter((m) => m.trim()),
      payerName: payerName.trim(),
    });
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Family" size="md">
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700">Family name</label>
            <input
              className={`w-full px-4 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] outline-none transition-all ${
                errors.name ? "border-red-400" : "border-gray-200"
              }`}
              placeholder="e.g., Sharma Family"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors({ ...errors, name: "" });
              }}
              autoFocus
            />
            {errors.name && <span className="text-xs text-red-500 font-medium">{errors.name}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-700">Members</label>
            {memberNames.map((m, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] transition-all"
                  placeholder={`Member ${i + 1} name`}
                  value={m}
                  onChange={(e) => {
                    const updated = [...memberNames];
                    updated[i] = e.target.value;
                    setMemberNames(updated);
                    setErrors({ ...errors, members: "" });
                  }}
                />
                {memberNames.length > 1 && (
                  <button
                    type="button"
                    className="p-2 text-gray-400 hover:text-red-500"
                    onClick={() => setMemberNames(memberNames.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="self-start text-xs font-bold text-emerald-500 hover:text-emerald-600 flex items-center gap-1"
              onClick={() => setMemberNames([...memberNames, ""])}
            >
              <Plus size={12} />
              <span>Add member</span>
            </button>
            {errors.members && <span className="text-xs text-red-500 font-medium">{errors.members}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700">
              Designated Payer <span className="text-gray-400 font-normal">(who pays for this family)</span>
            </label>
            <select
              className={`w-full px-4 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] outline-none cursor-pointer ${
                errors.payer ? "border-red-400" : "border-gray-200"
              }`}
              value={payerName}
              onChange={(e) => {
                setPayerName(e.target.value);
                setErrors({ ...errors, payer: "" });
              }}
            >
              <option value="">Select payer...</option>
              {memberNames.filter((m) => m.trim()).map((name, idx) => (
                <option key={idx} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {errors.payer && <span className="text-xs text-red-500 font-medium">{errors.payer}</span>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              className="px-4 py-2 border border-gray-250 text-gray-500 hover:bg-gray-50 text-sm font-semibold rounded-lg transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#1ec88f] hover:bg-[#17a876] text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center min-w-[100px]"
              disabled={saving}
            >
              {saving ? (
                <span className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
              ) : (
                "Add Family"
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

interface EmptyStateProps {
  icon: string;
  title: string;
  sub: string;
  children?: React.ReactNode;
}

function EmptyState({ icon, title, sub, children }: EmptyStateProps) {
  return (
    <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 flex flex-col items-center p-6 animate-in fade-in duration-300">
      <div className="text-4xl mb-3.5 select-none">{icon}</div>
      <h3 className="font-serif text-lg font-bold text-gray-950 mb-1">{title}</h3>
      <p className="text-xs text-gray-450 max-w-xs text-center border-none mb-5 font-semibold leading-relaxed">{sub}</p>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <div className="sticky top-0 bg-white border-b border-gray-100 h-16 flex-shrink-0" />
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-200/60 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-10 bg-gray-250 animate-pulse rounded-lg max-w-[200px]" />
        <div className="h-64 bg-gray-200 animate-pulse rounded-2xl" />
      </main>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white text-center">
      <div className="text-5xl mb-4">🔍</div>
      <h2 className="font-serif text-xl font-bold text-gray-900 mb-2">Trip Not Found</h2>
      <p className="text-xs text-gray-400 mb-6 text-center max-w-xs font-semibold">
        This trip does not exist, or it has been permanently removed by its owner.
      </p>
      <button
        onClick={() => navigate("/")}
        className="px-5 py-2.5 bg-[#1ec88f] hover:bg-[#17a876] text-white rounded-lg text-xs font-bold transition-all shadow-md animate-bounce"
      >
        Back to Trips
      </button>
    </div>
  );
}

// ── Add Category Modal ───────────────────────────────────────────────────────
interface AddCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (category: { value: string; label: string; color: string }) => void;
  existingCategories: any[];
}

function AddCategoryModal({ open, onClose, onAdd, existingCategories }: AddCategoryModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [error, setError] = useState("");

  const COLORS = [
    "#8B5CF6", "#F59E0B", "#3B82F6", "#EC4899", "#14B8A6",
    "#EF4444", "#6B7280", "#10B981", "#F97316", "#06B6D4",
    "#84CC16", "#A855F7", "#F43F5E", "#22D3EE", "#EAB308"
  ];

  useEffect(() => {
    if (open) {
      setName("");
      setEmoji("");
      setColor("#6366f1");
      setError("");
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }

    const value = name.trim().toLowerCase().replace(/\s+/g, "_");
    const label = `${emoji || "📌"} ${name.trim()}`;

    // Check if category already exists
    if (existingCategories.some(c => c.value === value)) {
      setError("This category already exists");
      return;
    }

    onAdd({ value, label, color });
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Custom Category" size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="e.g., Entertainment, Tips, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1ec88f] focus:border-transparent"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Emoji (optional)
          </label>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🎬 🎮 💈"
            maxLength={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1ec88f] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Color
          </label>
          <div className="grid grid-cols-8 gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${
                  color === c ? "border-gray-900 scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-[#1ec88f] text-white rounded-lg hover:bg-[#17a876] transition-colors"
          >
            Add Category
          </button>
        </div>
      </form>
    </Modal>
  );
}

