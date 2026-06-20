import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Users, Receipt, Calendar, ArrowRight, LogOut, Plane, TrendingUp, Globe, MapPin, Home, User, Crown } from "lucide-react";
import Modal from "../components/Modal";
import { getTrips, createTrip, deleteTrip, getSession, logOut } from "../store";
import { Trip, TripType } from "../types";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "INR", "SGD", "MXN", "THB", "IDR", "MYR", "PHP", "VND"];
const TRIP_EMOJIS = ["✈️", "🏖️", "🏔️", "🌴", "🗺️", "🚂", "🚢", "🏕️", "🌍", "🎒"];

interface FamilyForm {
  name: string;
  memberNames: string[];
  payerName: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const session = getSession();
  
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    description: "", 
    currency: "USD", 
    tripType: "friends" as TripType,
    members: ["", ""] as string[],
    families: [{ name: "", memberNames: ["", ""], payerName: "" }] as FamilyForm[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session) {
      setTrips(getTrips(session.id));
    }
  }, []);

  function refresh() {
    if (session) {
      setTrips(getTrips(session.id));
    }
  }

  function openCreate() {
    setForm({ 
      name: "", 
      description: "", 
      currency: "USD", 
      tripType: "friends",
      members: ["", ""],
      families: [{ name: "", memberNames: ["", ""], payerName: "" }],
    });
    setErrors({});
    setShowCreate(true);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Trip name is required";
    
    if (form.tripType === "family") {
      // Validate families
      const validFamilies = form.families.filter((f) => f.name.trim());
      if (validFamilies.length < 2) {
        errs.families = "Add at least 2 families for a family trip";
      }
      validFamilies.forEach((f, idx) => {
        const validMembers = f.memberNames.filter((m) => m.trim());
        if (validMembers.length < 1) {
          errs[`family_${idx}_members`] = `${f.name || `Family ${idx + 1}`} needs at least 1 member`;
        }
        if (!f.payerName.trim()) {
          errs[`family_${idx}_payer`] = `${f.name || `Family ${idx + 1}`} needs a designated payer`;
        } else if (!validMembers.includes(f.payerName)) {
          errs[`family_${idx}_payer`] = `Payer must be one of the family members`;
        }
      });
    } else if (form.tripType === "friends") {
      if (form.members.filter((m) => m.trim()).length < 2) {
        errs.members = "Add at least 2 members to start split tracking";
      }
    } else if (form.tripType === "solo") {
      if (form.members.filter((m) => m.trim()).length < 1) {
        errs.members = "Add at least 1 member";
      }
    }
    
    return errs;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 300));
    
    const trip = createTrip(session.id, {
      name: form.name.trim(),
      description: form.description.trim(),
      currency: form.currency,
      tripType: form.tripType,
      members: form.members.filter((m) => m.trim()),
      families: form.tripType === "family" 
        ? form.families
            .filter((f) => f.name.trim())
            .map((f) => ({
              name: f.name.trim(),
              memberNames: f.memberNames.filter((m) => m.trim()),
              payerName: f.payerName.trim(),
            }))
        : undefined,
    });
    
    setSaving(false);
    setShowCreate(false);
    refresh();
    navigate(`/trip/${trip.id}`);
  }

  function handleDelete() {
    if (!session || !deleteId) return;
    deleteTrip(session.id, deleteId);
    setDeleteId(null);
    refresh();
  }

  async function handleLogout() {
    await logOut();
    navigate("/auth", { replace: true });
  }

  function updateMember(i: number, val: string) {
    const m = [...form.members];
    m[i] = val;
    setForm({ ...form, members: m });
  }

  function addMemberField() {
    setForm({ ...form, members: [...form.members, ""] });
  }

  function removeMemberField(i: number) {
    const m = form.members.filter((_, idx) => idx !== i);
    setForm({ ...form, members: m });
  }

  const totalExpenses = (t: Trip) => t.expenses.reduce((s, e) => s + e.amount, 0);
  const tripEmoji = (t: Trip) => TRIP_EMOJIS[t.name.length % TRIP_EMOJIS.length];
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtAmt = (n: number, cur: string) => `${cur} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Cumulative and comparative metrics
  const totalTrips = trips.length;
  const totalSpentAll = trips.reduce((s, t) => s + t.expenses.reduce((ss, e) => ss + e.amount, 0), 0);
  const avgPerTrip = totalTrips > 0 ? totalSpentAll / totalTrips : 0;
  const currenciesUsed = [...new Set(trips.map((t) => t.currency))].length;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Navbar Header */}
      <header className="sticky top-0 z-[100] bg-white/90 backdrop-blur-md border-b border-gray-100 h-16">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9.5 h-9.5 bg-[#1ec88f] rounded-xl flex items-center justify-center text-white shadow-md">
              <Plane size={18} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-serif text-lg font-bold text-gray-950 tracking-tight">SplitTrack</span>
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Trip Expenses, Simplified</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white">
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full">
              <div className="w-6.5 h-26 border-none bg-emerald-500 rounded-full text-white text-[11px] font-bold flex items-center justify-center aspect-square select-none">
                {session?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="text-sm font-semibold text-gray-800">{session?.name}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all"
              title="Log out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-10 scale-99">
        
        {/* Editorial Hero Block */}
        <section className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10 pb-10 border-b border-gray-100 mb-10">
          <div className="flex-1">
            <h1 className="font-serif text-5xl font-extrabold text-gray-950 leading-tight mb-4 tracking-tight">
              Split expenses,<br />
              <em className="text-[#1ec88f] not-italic font-serif">not friendships.</em>
            </h1>
            <p className="text-gray-500 text-base leading-relaxed mb-6 max-w-md">
              Keep budgets clear, track receipts, and calculate optimal balance settlements instantly for any journey.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#1ec88f] hover:bg-[#17a876] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#1ec88f]/20 hover:scale-[1.01] transition-all"
            >
              <Plus size={16} />
              <span>Start a new trip</span>
            </button>
          </div>

          {/* Meaningful Home KPI Metrics */}
          <div className="flex flex-wrap gap-4 w-full lg:w-auto shrink-0 select-none">
            {[
              {
                label: "Trips Tracked",
                value: totalTrips,
                icon: <Plane size={16} className="text-blue-500" />,
                bg: "bg-blue-50"
              },
              {
                label: "Total Spent",
                value: totalSpentAll >= 1000 ? `${(totalSpentAll / 1000).toFixed(1)}k` : totalSpentAll.toFixed(0),
                icon: <TrendingUp size={16} className="text-emerald-500" />,
                bg: "bg-emerald-50"
              },
              {
                label: "Avg Per Trip",
                value: avgPerTrip >= 1000 ? `${(avgPerTrip / 1000).toFixed(1)}k` : avgPerTrip.toFixed(0),
                icon: <Receipt size={16} className="text-amber-500" />,
                bg: "bg-amber-50"
              },
              {
                label: "Currencies",
                value: currenciesUsed || "—",
                icon: <Globe size={16} className="text-pink-500" />,
                bg: "bg-pink-50"
              }
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200/80 rounded-xl p-4 flex flex-col items-center gap-1 min-w-[105px] flex-1 lg:flex-initial shadow-xs hover:border-[#1ec88f]/50 transition-all"
              >
                <div className={`${stat.bg} p-2 rounded-lg`}>{stat.icon}</div>
                <span className="font-serif text-2xl font-bold text-gray-900 leading-none">{stat.value}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Trips Grid Section */}
        <section className="animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-bold text-gray-950">Your Trips</h2>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1ec88f]/10 text-emerald-700 hover:bg-[#1ec88f] hover:text-white rounded-lg text-xs font-bold transition-all"
            >
              <Plus size={14} />
              <span>New Trip</span>
            </button>
          </div>

          {trips.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50 flex flex-col items-center">
              <div className="text-5xl mb-4">🗺️</div>
              <h3 className="font-serif text-xl font-bold text-gray-900 mb-1">No trips logged yet</h3>
              <p className="text-sm text-gray-400 max-w-sm mb-6">
                Create a trip, add your travel friends, and start splitting dinner bills!
              </p>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1ec88f] hover:bg-[#17a876] text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-[#1ec88f]/10"
              >
                <Plus size={15} />
                <span>Create your first trip</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trips.map((trip) => (
                <article
                  key={trip.id}
                  onClick={() => navigate(`/trip/${trip.id}`)}
                  className="bg-white border border-gray-150 hover:border-emerald-500 rounded-2xl p-6 cursor-pointer transform hover:-translate-y-1 shadow-xs hover:shadow-lg transition-all group flex flex-col"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/trip/${trip.id}`)}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <span className="text-3xl filter saturate-100">{tripEmoji(trip)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-serif text-lg font-bold text-gray-900 leading-tight group-hover:text-emerald-700 transition-colors truncate">
                          {trip.name}
                        </h3>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${
                          (trip.tripType || "friends") === "family"
                            ? "bg-purple-100 text-purple-700"
                            : (trip.tripType || "friends") === "solo"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {trip.tripType || "friends"}
                        </span>
                      </div>
                      {trip.description && (
                        <p className="text-xs text-gray-400 font-medium truncate mt-1">
                          {trip.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Delete Trip Card */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(trip.id);
                      }}
                      className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg shrink-0 transition-colors"
                      title="Delete trip"
                      aria-label="Delete trip"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 mb-6 font-medium">
                    {(trip.tripType === "family" && trip.families && trip.families.length > 0) ? (
                      <span className="flex items-center gap-1 text-gray-500 shrink-0">
                        <Home size={12} className="text-[#1ec88f]" />
                        {trip.families.length} families
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500 shrink-0">
                        <Users size={12} className="text-[#1ec88f]" />
                        {trip.members.length} members
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-gray-500 shrink-0">
                      <Receipt size={12} className="text-[#1ec88f]" />
                      {trip.expenses.length} expenses
                    </span>
                    <span className="flex items-center gap-1 text-gray-500 shrink-0">
                      <Calendar size={12} className="text-[#1ec88f]" />
                      {fmtDate(trip.createdAt)}
                    </span>
                  </div>

                  {/* Card bottom strip */}
                  <div className="flex items-center justify-between pt-4 mt-auto border-t border-gray-100 gap-2">
                    <div className="flex flex-col leading-tight">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Spent</span>
                      <span className="font-serif text-base font-bold text-gray-900 mt-1">
                        {fmtAmt(totalExpenses(trip), trip.currency)}
                      </span>
                    </div>

                    <div className="flex items-center">
                      <div className="flex items-center -space-x-1.5 shrink-0 mr-4">
                        {trip.members.slice(0, 3).map((m, idx) => (
                          <div
                            key={m.id}
                            className="w-6.5 h-6.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border-2 border-white text-[10px] flex items-center justify-center shrink-0 uppercase select-none"
                            style={{ zIndex: 10 - idx }}
                          >
                            {m.name[0]}
                          </div>
                        ))}
                        {trip.members.length > 3 && (
                          <div className="w-6.5 h-6.5 rounded-full bg-gray-100 text-gray-500 font-bold border-2 border-white text-[9px] flex items-center justify-center shrink-0">
                            +{trip.members.length - 3}
                          </div>
                        )}
                      </div>
                      
                      <span className="text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all shrink-0">
                        <ArrowRight size={15} />
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create Trip Form Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create a new trip" size="lg">
        <form onSubmit={handleCreate} noValidate>
          <div className="flex flex-col gap-5">
            
            {/* Trip Type Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-700">Trip Type</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-all ${
                    form.tripType === "family"
                      ? "border-[#1ec88f] bg-emerald-50/50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setForm({ ...form, tripType: "family" })}
                >
                  <Home size={24} className={form.tripType === "family" ? "text-[#1ec88f]" : "text-gray-400"} />
                  <span className={`text-sm font-bold ${form.tripType === "family" ? "text-[#1ec88f]" : "text-gray-700"}`}>
                    Family
                  </span>
                  <span className="text-[10px] text-gray-500 text-center">
                    Multiple families traveling together
                  </span>
                </button>
                
                <button
                  type="button"
                  className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-all ${
                    form.tripType === "friends"
                      ? "border-[#1ec88f] bg-emerald-50/50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setForm({ ...form, tripType: "friends" })}
                >
                  <Users size={24} className={form.tripType === "friends" ? "text-[#1ec88f]" : "text-gray-400"} />
                  <span className={`text-sm font-bold ${form.tripType === "friends" ? "text-[#1ec88f]" : "text-gray-700"}`}>
                    Friends
                  </span>
                  <span className="text-[10px] text-gray-500 text-center">
                    Group of friends or colleagues
                  </span>
                </button>
                
                <button
                  type="button"
                  className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition-all ${
                    form.tripType === "solo"
                      ? "border-[#1ec88f] bg-emerald-50/50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setForm({ ...form, tripType: "solo" })}
                >
                  <User size={24} className={form.tripType === "solo" ? "text-[#1ec88f]" : "text-gray-400"} />
                  <span className={`text-sm font-bold ${form.tripType === "solo" ? "text-[#1ec88f]" : "text-gray-700"}`}>
                    Solo
                  </span>
                  <span className="text-[10px] text-gray-500 text-center">
                    Personal trip tracking
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700" htmlFor="t-name">
                Trip name <span className="text-red-500">*</span>
              </label>
              <input
                id="t-name"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 transition-all ${
                  errors.name ? "border-red-400 focus:border-red-400" : "border-gray-200"
                }`}
                placeholder="e.g. Kyoto Cherry Blossom 2025"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setErrors({ ...errors, name: "" });
                }}
                autoFocus
              />
              {errors.name && <span className="text-xs text-red-500 font-medium">{errors.name}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700" htmlFor="t-desc">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="t-desc"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 resize-none transition-all"
                placeholder="A brief memo or note"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700" htmlFor="t-cur">
                Currency
              </label>
              <select
                id="t-cur"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] outline-none cursor-pointer select-none"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Family Trip Form */}
            {form.tripType === "family" && (
              <div className="flex flex-col gap-4 border-t border-gray-100 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">Families</span>
                  {errors.families && (
                    <span className="text-xs text-red-500 font-medium">{errors.families}</span>
                  )}
                </div>
                
                <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-2">
                  {form.families.map((family, famIdx) => (
                    <div key={famIdx} className="flex flex-col gap-3 p-4 bg-gray-50/50 border border-gray-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">Family {famIdx + 1}</span>
                        {form.families.length > 1 && (
                          <button
                            type="button"
                            className="text-gray-400 hover:text-red-500 p-1"
                            onClick={() => {
                              const fams = form.families.filter((_, i) => i !== famIdx);
                              setForm({ ...form, families: fams });
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      
                      <input
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 transition-all"
                        placeholder="Family name (e.g., Sharma Family)"
                        value={family.name}
                        onChange={(e) => {
                          const fams = [...form.families];
                          fams[famIdx] = { ...fams[famIdx], name: e.target.value };
                          setForm({ ...form, families: fams });
                        }}
                      />
                      
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-gray-600">Members</label>
                        {family.memberNames.map((member, memIdx) => (
                          <div key={memIdx} className="flex gap-2 items-center">
                            <input
                              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-900 focus:border-[#1ec88f] transition-all"
                              placeholder={`Member ${memIdx + 1} name`}
                              value={member}
                              onChange={(e) => {
                                const fams = [...form.families];
                                fams[famIdx].memberNames[memIdx] = e.target.value;
                                setForm({ ...form, families: fams });
                              }}
                            />
                            {family.memberNames.length > 1 && (
                              <button
                                type="button"
                                className="p-1.5 text-gray-400 hover:text-red-500"
                                onClick={() => {
                                  const fams = [...form.families];
                                  fams[famIdx].memberNames = fams[famIdx].memberNames.filter((_, i) => i !== memIdx);
                                  setForm({ ...form, families: fams });
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          className="text-xs font-bold text-emerald-500 hover:text-emerald-600 flex items-center gap-1"
                          onClick={() => {
                            const fams = [...form.families];
                            fams[famIdx].memberNames.push("");
                            setForm({ ...form, families: fams });
                          }}
                        >
                          <Plus size={12} />
                          <span>Add member</span>
                        </button>
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600">
                          Designated Payer <span className="text-gray-400 font-normal">(who pays for this family)</span>
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-900 focus:border-[#1ec88f] outline-none cursor-pointer"
                          value={family.payerName}
                          onChange={(e) => {
                            const fams = [...form.families];
                            fams[famIdx].payerName = e.target.value;
                            setForm({ ...form, families: fams });
                          }}
                        >
                          <option value="">Select payer...</option>
                          {family.memberNames.filter((m) => m.trim()).map((name, idx) => (
                            <option key={idx} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                        {errors[`family_${famIdx}_payer`] && (
                          <span className="text-xs text-red-500 font-medium">{errors[`family_${famIdx}_payer`]}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  type="button"
                  className="self-start text-xs font-bold text-emerald-500 hover:text-emerald-600 flex items-center gap-1.5"
                  onClick={() => {
                    setForm({
                      ...form,
                      families: [...form.families, { name: "", memberNames: ["", ""], payerName: "" }],
                    });
                  }}
                >
                  <Plus size={13} />
                  <span>Add another family</span>
                </button>
              </div>
            )}

            {/* Friends/Solo Trip Form */}
            {(form.tripType === "friends" || form.tripType === "solo") && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                  <span className="text-xs font-semibold text-gray-700">
                    Members <span className="text-red-500">*</span>
                  </span>
                  {errors.members && (
                    <span className="text-xs text-red-500 font-medium">{errors.members}</span>
                  )}
                </div>
                
                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {form.members.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 transition-all"
                        placeholder={form.tripType === "solo" ? "Your name" : `Friend ${i + 1}`}
                        value={m}
                        onChange={(e) => {
                          updateMember(i, e.target.value);
                          setErrors({ ...errors, members: "" });
                        }}
                      />
                      {(form.tripType === "friends" ? form.members.length > 2 : form.members.length > 1) && (
                        <button
                          type="button"
                          className="p-2 border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 rounded-lg shrink-0 transition-colors"
                          onClick={() => removeMemberField(i)}
                          title="Remove member"
                          aria-label="Remove member"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <button
                  type="button"
                  className="self-start text-xs font-bold text-emerald-500 hover:text-emerald-600 flex items-center gap-1.5 mt-1"
                  onClick={addMemberField}
                >
                  <Plus size={13} />
                  <span>Add another member</span>
                </button>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
              <button
                type="button"
                className="px-4 py-2 border border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-semibold transition-colors"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#1ec88f] hover:bg-[#17a876] text-white rounded-lg text-sm font-bold flex items-center justify-center transition-colors min-w-[100px]"
                disabled={saving}
              >
                {saving ? (
                  <span className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                ) : (
                  "Create Trip"
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Trip Confirmation Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete trip?" size="sm">
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          This will permanently delete the trip and erase its expenses, receipts, and settlements. This copy cannot be recovered.
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 border border-gray-250 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
            onClick={() => setDeleteId(null)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors"
            onClick={handleDelete}
          >
            Delete Trip
          </button>
        </div>
      </Modal>
    </div>
  );
}
