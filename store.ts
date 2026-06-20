import { v4 as uuidv4 } from "uuid";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser
} from "firebase/auth";
import { auth } from "./firebase";
import { User, Session, Trip, TripMember, Expense, PayerContribution, SettledPair, Family, TripType } from "./types";

const DATA_KEY = "splittrack_data_v2";

// ── Auth Helpers (Firebase) ──────────────────────────────────────────────────

export async function signUp({ name, email, password }: Omit<User, "id">): Promise<{ user?: Session; error?: string }> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email.toLowerCase(), password);
    const firebaseUser = userCredential.user;
    
    // Store display name in Firebase
    await firebaseUser.updateProfile({ displayName: name });
    
    const sess: Session = { 
      id: firebaseUser.uid, 
      name: firebaseUser.displayName || name, 
      email: firebaseUser.email || email.toLowerCase() 
    };
    
    return { user: sess };
  } catch (error: any) {
    const errorCode = error.code;
    let errorMessage = "An error occurred during sign up.";
    
    if (errorCode === "auth/email-already-in-use") {
      errorMessage = "An account with this email already exists.";
    } else if (errorCode === "auth/invalid-email") {
      errorMessage = "Invalid email address.";
    } else if (errorCode === "auth/weak-password") {
      errorMessage = "Password should be at least 6 characters.";
    } else if (errorCode === "auth/operation-not-allowed") {
      errorMessage = "Email/password accounts are not enabled. Contact support.";
    }
    
    return { error: errorMessage };
  }
}

export async function logIn({ email, password }: Omit<User, "id" | "name">): Promise<{ user?: Session; error?: string }> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
    const firebaseUser = userCredential.user;
    
    const sess: Session = { 
      id: firebaseUser.uid, 
      name: firebaseUser.displayName || "User", 
      email: firebaseUser.email || email.toLowerCase() 
    };
    
    return { user: sess };
  } catch (error: any) {
    const errorCode = error.code;
    let errorMessage = "An error occurred during login.";
    
    if (errorCode === "auth/user-not-found" || errorCode === "auth/invalid-credential") {
      errorMessage = "Incorrect email or password.";
    } else if (errorCode === "auth/wrong-password") {
      errorMessage = "Incorrect password.";
    } else if (errorCode === "auth/invalid-email") {
      errorMessage = "Invalid email address.";
    } else if (errorCode === "auth/too-many-requests") {
      errorMessage = "Too many failed attempts. Please try again later.";
    }
    
    return { error: errorMessage };
  }
}

export async function forgotPassword(email: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await sendPasswordResetEmail(auth, email.toLowerCase());
    return { success: true };
  } catch (error: any) {
    const errorCode = error.code;
    let errorMessage = "An error occurred while sending reset email.";
    
    if (errorCode === "auth/user-not-found") {
      errorMessage = "No account found with this email address.";
    } else if (errorCode === "auth/invalid-email") {
      errorMessage = "Invalid email address.";
    } else if (errorCode === "auth/too-many-requests") {
      errorMessage = "Too many requests. Please try again later.";
    }
    
    return { error: errorMessage };
  }
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

export function getSession(): Session | null {
  const user = auth.currentUser;
  if (!user) return null;
  
  return { 
    id: user.uid, 
    name: user.displayName || "User", 
    email: user.email || "" 
  };
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      const session: Session = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || "User",
        email: firebaseUser.email || ""
      };
      callback(session);
    } else {
      callback(null);
    }
  });
}

// ── Per-User Data Helpers ────────────────────────────────────────────────────

interface UserStorageData {
  trips: Trip[];
}

function getData(userId: string): UserStorageData {
  try {
    const raw = localStorage.getItem(`${DATA_KEY}_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { trips: [] };
}

function saveData(userId: string, data: UserStorageData) {
  try {
    localStorage.setItem(`${DATA_KEY}_${userId}`, JSON.stringify(data));
  } catch (e: any) {
    if (
      e &&
      (e.name === "QuotaExceededError" ||
        e.code === 22 ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      // Self-heal: Clean up any extremely large historical base64 receipt images to recover browser capacity
      let clearedAny = false;
      data.trips.forEach((trip) => {
        trip.expenses.forEach((exp) => {
          if (exp.receipt && exp.receipt.length > 50000) {
            exp.receipt = null;
            clearedAny = true;
          }
        });
      });
      if (clearedAny) {
        try {
          localStorage.setItem(`${DATA_KEY}_${userId}`, JSON.stringify(data));
          console.warn("Cleared legacy high-resolution receipts to repair local storage limit.");
          return;
        } catch (retryErr) {}
      }
      // If we still can't save, alert the user
      alert("Local storage capacity is fully exhausted! Please archive or delete some old trip logs to free up storage.");
    } else {
      throw e;
    }
  }
}

// ── Trips Management ─────────────────────────────────────────────────────────

export function getTrips(userId: string): Trip[] {
  return getData(userId).trips;
}

export function getTrip(userId: string, id: string): Trip | null {
  return getData(userId).trips.find((t) => t.id === id) || null;
}

export function createTrip(
  userId: string,
  { name, description, currency, tripType, members, families }: { 
    name: string; 
    description?: string; 
    currency?: string; 
    tripType: TripType;
    members: string[];
    families?: { name: string; memberNames: string[]; payerName: string }[];
  }
): Trip {
  const data = getData(userId);
  
  let allMembers: TripMember[] = [];
  let allFamilies: Family[] = [];
  
  if (tripType === "family" && families && families.length > 0) {
    // Create families with their members
    families.forEach((fam) => {
      const familyId = uuidv4();
      const familyMembers: TripMember[] = fam.memberNames.map((mName) => ({
        id: uuidv4(),
        name: mName,
        familyId,
      }));
      
      // Find the payer (first member matching payerName, or create if not in list)
      let payerMember = familyMembers.find((m) => m.name === fam.payerName);
      if (!payerMember && familyMembers.length > 0) {
        payerMember = familyMembers[0];
      }
      
      allMembers.push(...familyMembers);
      allFamilies.push({
        id: familyId,
        name: fam.name,
        members: familyMembers.map((m) => m.id),
        payerId: payerMember?.id || "",
      });
    });
  } else {
    // Friends or solo trip - just flat members
    allMembers = members.map((m) => ({ id: uuidv4(), name: m }));
  }
  
  const trip: Trip = {
    id: uuidv4(),
    name,
    description: description || "",
    currency: currency || "USD",
    tripType,
    members: allMembers,
    families: allFamilies,
    expenses: [],
    settledPairs: [],
    createdAt: new Date().toISOString(),
  };
  data.trips.unshift(trip);
  saveData(userId, data);
  return trip;
}

export function deleteTrip(userId: string, id: string): void {
  const data = getData(userId);
  data.trips = data.trips.filter((t) => t.id !== id);
  saveData(userId, data);
}

export function addMember(userId: string, tripId: string, name: string, familyId?: string): TripMember | null {
  const data = getData(userId);
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip) return null;
  const member: TripMember = { id: uuidv4(), name, familyId };
  trip.members.push(member);
  
  // If familyId provided, add member to that family
  if (familyId && trip.families) {
    const family = trip.families.find((f) => f.id === familyId);
    if (family) {
      family.members.push(member.id);
    }
  }
  
  saveData(userId, data);
  return member;
}

export function removeMember(userId: string, tripId: string, memberId: string): void {
  const data = getData(userId);
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip) return;
  
  // Remove from families if applicable
  if (trip.families) {
    trip.families.forEach((fam) => {
      fam.members = fam.members.filter((id) => id !== memberId);
      if (fam.payerId === memberId) {
        // If removed member was the payer, assign first remaining member as payer
        fam.payerId = fam.members[0] || "";
      }
    });
  }
  
  trip.members = trip.members.filter((m) => m.id !== memberId);
  trip.expenses = trip.expenses.filter(
    (e) => !e.paidBy.some((p) => p.memberId === memberId) && !e.splitAmong.includes(memberId)
  );
  trip.settledPairs = (trip.settledPairs || []).filter(
    (p) => p.from !== memberId && p.to !== memberId
  );
  saveData(userId, data);
}

// ── Family Management ────────────────────────────────────────────────────────

export function addFamily(
  userId: string, 
  tripId: string, 
  { name, memberNames, payerName }: { name: string; memberNames: string[]; payerName: string }
): Family | null {
  const data = getData(userId);
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip || trip.tripType !== "family") return null;
  
  const familyId = uuidv4();
  const familyMembers: TripMember[] = memberNames.map((mName) => ({
    id: uuidv4(),
    name: mName,
    familyId,
  }));
  
  // Find payer
  let payerMember = familyMembers.find((m) => m.name === payerName);
  if (!payerMember && familyMembers.length > 0) {
    payerMember = familyMembers[0];
  }
  
  trip.members.push(...familyMembers);
  
  const family: Family = {
    id: familyId,
    name,
    members: familyMembers.map((m) => m.id),
    payerId: payerMember?.id || "",
  };
  
  if (!trip.families) trip.families = [];
  trip.families.push(family);
  
  saveData(userId, data);
  return family;
}

export function removeFamily(userId: string, tripId: string, familyId: string): void {
  const data = getData(userId);
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip || !trip.families) return;
  
  const family = trip.families.find((f) => f.id === familyId);
  if (!family) return;
  
  // Remove all family members
  family.members.forEach((memberId) => {
    trip.members = trip.members.filter((m) => m.id !== memberId);
    trip.expenses = trip.expenses.filter(
      (e) => !e.paidBy.some((p) => p.memberId === memberId) && !e.splitAmong.includes(memberId)
    );
    trip.settledPairs = (trip.settledPairs || []).filter(
      (p) => p.from !== memberId && p.to !== memberId
    );
  });
  
  trip.families = trip.families.filter((f) => f.id !== familyId);
  saveData(userId, data);
}

export function updateFamilyPayer(userId: string, tripId: string, familyId: string, newPayerId: string): void {
  const data = getData(userId);
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip || !trip.families) return;
  
  const family = trip.families.find((f) => f.id === familyId);
  if (family) {
    family.payerId = newPayerId;
    saveData(userId, data);
  }
}

// ── Settlement Tracking ──────────────────────────────────────────────────────

export function markSettled(userId: string, tripId: string, from: string, to: string): void {
  const data = getData(userId);
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip) return;
  if (!trip.settledPairs) trip.settledPairs = [];
  const key = [from, to].sort().join("__");
  if (!trip.settledPairs.find((p) => [p.from, p.to].sort().join("__") === key)) {
    trip.settledPairs.push({ from, to, settledAt: new Date().toISOString() });
  }
  saveData(userId, data);
}

export function unmarkSettled(userId: string, tripId: string, from: string, to: string): void {
  const data = getData(userId);
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip || !trip.settledPairs) return;
  const key = [from, to].sort().join("__");
  trip.settledPairs = trip.settledPairs.filter(
    (p) => [p.from, p.to].sort().join("__") !== key
  );
  saveData(userId, data);
}

export function isSettled(trip: Trip, from: string, to: string): boolean {
  if (!trip.settledPairs) return false;
  const key = [from, to].sort().join("__");
  return trip.settledPairs.some((p) => [p.from, p.to].sort().join("__") === key);
}

// ── Expenses Management ──────────────────────────────────────────────────────

export function addExpense(
  userId: string,
  tripId: string,
  {
    description,
    amount,
    category,
    paidBy,
    splitAmong,
    date,
    receipt,
  }: Omit<Expense, "id" | "createdAt">
): Expense | null {
  const data = getData(userId);
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip) return null;
  const expense: Expense = {
    id: uuidv4(),
    description,
    amount: parseFloat(amount as any),
    category: category || "other",
    paidBy: normalisePaidBy(paidBy, parseFloat(amount as any)),
    splitAmong,
    date: date || new Date().toISOString().split("T")[0],
    receipt: receipt || null,
    createdAt: new Date().toISOString(),
  };
  trip.expenses.unshift(expense);
  saveData(userId, data);
  return expense;
}

export function updateExpense(
  userId: string,
  tripId: string,
  expenseId: string,
  updates: Partial<Expense>
): Expense | null {
  const data = getData(userId);
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip) return null;
  const idx = trip.expenses.findIndex((e) => e.id === expenseId);
  if (idx === -1) return null;
  
  const merged = { ...trip.expenses[idx], ...updates };
  if (updates.paidBy !== undefined) {
    merged.paidBy = normalisePaidBy(updates.paidBy, merged.amount);
  }
  trip.expenses[idx] = merged;
  saveData(userId, data);
  return trip.expenses[idx];
}

export function deleteExpense(userId: string, tripId: string, expenseId: string): void {
  const data = getData(userId);
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip) return;
  trip.expenses = trip.expenses.filter((e) => e.id !== expenseId);
  saveData(userId, data);
}

function normalisePaidBy(paidBy: any, totalAmount: number): PayerContribution[] {
  if (!paidBy) return [];
  if (Array.isArray(paidBy) && paidBy.length > 0 && typeof paidBy[0] === "object") {
    return paidBy;
  }
  if (typeof paidBy === "string") {
    return [{ memberId: paidBy, amount: totalAmount }];
  }
  if (Array.isArray(paidBy)) {
    const share = totalAmount / paidBy.length;
    return paidBy.map((id) => ({ memberId: id, amount: share }));
  }
  return [];
}

// ── Balances & Settlements Calculations ──────────────────────────────────────

export function computeBalances(trip: Trip): Record<string, number> {
  const balances: Record<string, number> = {};
  trip.members.forEach((m) => {
    balances[m.id] = 0;
  });
  
  trip.expenses.forEach((expense) => {
    const share = expense.amount / (expense.splitAmong.length || 1);
    expense.splitAmong.forEach((id) => {
      balances[id] = (balances[id] || 0) - share;
    });
    (expense.paidBy || []).forEach(({ memberId, amount }) => {
      balances[memberId] = (balances[memberId] || 0) + amount;
    });
  });
  
  return balances;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function computeSettlements(trip: Trip): Settlement[] {
  const balances = computeBalances(trip);
  const settlements: Settlement[] = [];
  
  const debtors = Object.entries(balances)
    .filter(([, b]) => b < -0.005)
    .map(([id, b]) => ({ id, amount: -b }))
    .sort((a, b) => b.amount - a.amount);
    
  const creditors = Object.entries(balances)
    .filter(([, b]) => b > 0.005)
    .map(([id, b]) => ({ id, amount: b }))
    .sort((a, b) => b.amount - a.amount);
    
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);
    
    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount: Math.round(amount * 100) / 100,
    });
    
    debtor.amount -= amount;
    creditor.amount -= amount;
    
    if (debtor.amount < 0.005) i++;
    if (creditor.amount < 0.005) j++;
  }
  
  return settlements;
}

// Compute family-level settlements (only between designated payers)
export function computeFamilySettlements(trip: Trip): Settlement[] {
  if (!trip.families || trip.families.length === 0) {
    return computeSettlements(trip);
  }
  
  const balances = computeBalances(trip);
  const payerBalances: Record<string, number> = {};
  
  // Aggregate all member balances to their family's payer
  trip.families.forEach((family) => {
    if (!family.payerId) return;
    
    let familyBalance = 0;
    family.members.forEach((memberId) => {
      familyBalance += balances[memberId] || 0;
    });
    
    payerBalances[family.payerId] = familyBalance;
  });
  
  const settlements: Settlement[] = [];
  
  const debtors = Object.entries(payerBalances)
    .filter(([, b]) => b < -0.005)
    .map(([id, b]) => ({ id, amount: -b }))
    .sort((a, b) => b.amount - a.amount);
    
  const creditors = Object.entries(payerBalances)
    .filter(([, b]) => b > 0.005)
    .map(([id, b]) => ({ id, amount: b }))
    .sort((a, b) => b.amount - a.amount);
    
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);
    
    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount: Math.round(amount * 100) / 100,
    });
    
    debtor.amount -= amount;
    creditor.amount -= amount;
    
    if (debtor.amount < 0.005) i++;
    if (creditor.amount < 0.005) j++;
  }
  
  return settlements;
}
