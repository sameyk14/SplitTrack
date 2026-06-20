export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
}

export interface Session {
  id: string;
  name: string;
  email: string;
}

export interface TripMember {
  id: string;
  name: string;
  familyId?: string; // Links member to a family (for family trips)
}

export interface Family {
  id: string;
  name: string; // e.g., "Sharma Family", "John's Family"
  members: string[]; // Member IDs in this family
  payerId: string; // The designated payer (e.g., dad) who pays for this family
}

export interface PayerContribution {
  memberId: string;
  amount: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  paidBy: PayerContribution[]; // Supports combined multi-payer contributions
  splitAmong: string[]; // List of member IDs
  date: string;
  receipt: string | null; // Base64 data string of loaded image/receipt
  createdAt: string;
}

export interface SettledPair {
  from: string;
  to: string;
  settledAt: string;
}

export type TripType = "family" | "friends" | "solo";

export interface Trip {
  id: string;
  name: string;
  description: string;
  currency: string;
  tripType: TripType; // "family" | "friends" | "solo"
  members: TripMember[];
  families: Family[]; // Only used for family trips
  expenses: Expense[];
  settledPairs: SettledPair[]; // Tracks manually settled pairs
  createdAt: string;
}
