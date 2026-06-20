import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plane, Eye, EyeOff, ArrowRight } from "lucide-react";
import { signUp, logIn, onAuthChange, forgotPassword } from "../store";

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange((session) => {
      if (session) {
        navigate("/", { replace: true });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  function setField(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setGlobalError("");
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (mode === "signup" && !form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) {
      errs.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      errs.email = "Enter a valid email";
    }
    if (mode !== "forgot") {
      if (!form.password) {
        errs.password = "Password is required";
      } else if (form.password.length < 6) {
        errs.password = "Must be at least 6 characters";
      }
      if (mode === "signup" && form.password !== form.confirm) {
        errs.confirm = "Passwords do not match";
      }
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    setGlobalError("");
    
    try {
      if (mode === "forgot") {
        const res = await forgotPassword(form.email.trim());
        if (res.error) {
          setGlobalError(res.error);
          setLoading(false);
          return;
        }
        setResetSuccess(true);
        setLoading(false);
      } else if (mode === "signup") {
        const res = await signUp({ name: form.name.trim(), email: form.email.trim(), password: form.password });
        if (res.error) {
          setGlobalError(res.error);
          setLoading(false);
          return;
        }
        setLoading(false);
        navigate("/", { replace: true });
      } else {
        const res = await logIn({ email: form.email.trim(), password: form.password });
        if (res.error) {
          setGlobalError(res.error);
          setLoading(false);
          return;
        }
        setLoading(false);
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      setGlobalError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  }

  function switchMode(m: "login" | "signup" | "forgot") {
    setMode(m);
    setErrors({});
    setGlobalError("");
    setResetSuccess(false);
    setForm({ name: "", email: "", password: "", confirm: "" });
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left panel: Brand and highlights */}
      <div className="hidden md:flex flex-1 bg-gradient-to-br from-[#0f1923] via-[#1a2e22] to-[#0d2419] items-center justify-center p-12 relative overflow-hidden">
        {/* Glow gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(30,200,143,0.18),transparent_60%)] z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(30,200,143,0.08),transparent_50%)] z-0" />
        
        <div className="relative z-10 max-w-md w-full">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-[#1ec88f] rounded-xl flex items-center justify-center text-white shadow-lg">
              <Plane size={22} strokeWidth={2.5} />
            </div>
            <span className="font-serif text-2xl font-bold text-white tracking-tight">
              SplitTrack
            </span>
          </div>
          
          <h1 className="font-serif text-white font-bold leading-tight tracking-tight text-5xl mb-6">
            Split expenses,<br />
            <em className="text-[#1ec88f] not-italic font-serif">not friendships.</em>
          </h1>
          
          <p className="text-gray-300/85 text-base leading-relaxed mb-10 max-w-sm">
            Track every shared cost on your trips. See who owes whom — instantly, fairly, and transparently.
          </p>
          
          <ul className="flex flex-col gap-4 text-gray-200">
            {[
              "Track shared trip expenses simply",
              "See real-time personal balances",
              "Settle up debts with one tap",
              "Split bills cleanly with multiple payers",
            ].map((text, i) => (
              <li key={i} className="flex items-center gap-3 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-[#1ec88f] shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel: Login box */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
          
          {/* Logo on mobile devices */}
          <div className="flex md:hidden items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 bg-[#1ec88f] rounded-lg flex items-center justify-center text-white shadow-md">
              <Plane size={18} strokeWidth={2.5} />
            </div>
            <span className="font-serif text-xl font-bold text-gray-900 tracking-tight">
              SplitTrack
            </span>
          </div>

          <div className="bg-gray-50/75 p-1 rounded-2xl flex border border-gray-100 mb-8">
            <button
              className={`flex-1 py-2 text-center rounded-xl text-sm font-semibold transition-all ${
                mode === "login" ? "bg-white text-gray-900 shadow-xs font-bold" : "text-gray-500 hover:text-gray-900"
              }`}
              onClick={() => switchMode("login")}
            >
              Log in
            </button>
            <button
              className={`flex-1 py-2 text-center rounded-xl text-sm font-semibold transition-all ${
                mode === "signup" ? "bg-white text-gray-900 shadow-xs font-bold" : "text-gray-500 hover:text-gray-900"
              }`}
              onClick={() => switchMode("signup")}
            >
              Sign up
            </button>
          </div>

          <h2 className="font-serif text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            {mode === "login"
              ? "Log in to access your trips and settle up your expenses."
              : mode === "signup"
              ? "Sign up free — all data is saved securely on your device."
              : "Enter your email and we'll send you a link to reset your password."}
          </p>

          {globalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6 animate-in slide-in-from-top-1">
              {globalError}
            </div>
          )}

          {resetSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-4 mb-6 animate-in slide-in-from-top-1">
              Password reset link sent! Check your email inbox.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            {mode === "signup" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700" htmlFor="auth-name">Your name</label>
                <input
                  id="auth-name"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 transition-all ${
                    errors.name ? "border-red-400 focus:border-red-400 focus:ring-red-100" : "border-gray-200"
                  }`}
                  placeholder="e.g. Alex Johnson"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  autoComplete="name"
                />
                {errors.name && <span className="text-xs text-red-500 font-medium">{errors.name}</span>}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700" htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 transition-all ${
                  errors.email ? "border-red-400 focus:border-red-400 focus:ring-red-100" : "border-gray-200"
                }`}
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                autoComplete="email"
              />
              {errors.email && <span className="text-xs text-red-500 font-medium">{errors.email}</span>}
            </div>

            {mode !== "forgot" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700" htmlFor="auth-pw">Password</label>
                <div className="relative">
                  <input
                    id="auth-pw"
                    className={`w-full pl-4 pr-11 py-2.5 border rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 transition-all ${
                      errors.password ? "border-red-400 focus:border-red-400 focus:ring-red-100" : "border-gray-200"
                    }`}
                    type={showPw ? "text" : "password"}
                    placeholder={mode === "signup" ? "Min. 6 characters" : "Enter password"}
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <span className="text-xs text-red-500 font-medium">{errors.password}</span>}
              </div>
            )}

            {mode === "signup" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700" htmlFor="auth-confirm">Confirm password</label>
                <input
                  id="auth-confirm"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400 focus:border-[#1ec88f] focus:ring-1 focus:ring-[#1ec88f]/10 transition-all ${
                    errors.confirm ? "border-red-400 focus:border-red-400 focus:ring-red-100" : "border-gray-200"
                  }`}
                  type={showPw ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={form.confirm}
                  onChange={(e) => setField("confirm", e.target.value)}
                  autoComplete="new-password"
                />
                {errors.confirm && <span className="text-xs text-red-500 font-medium">{errors.confirm}</span>}
              </div>
            )}

            {mode === "login" && (
              <div className="flex justify-end -mt-2">
                <button
                  type="button"
                  className="text-xs text-emerald-500 hover:text-emerald-600 font-semibold"
                  onClick={() => switchMode("forgot")}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-2 py-3 bg-[#1ec88f] hover:bg-[#17a876] active:scale-[0.99] text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-[#1ec88f]/20 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === "login" ? "Log In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
                  </span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500">
            {mode === "login" ? "Don't have an account?" : mode === "signup" ? "Already have an account?" : "Remember your password?"}{" "}
            <button
              className="text-emerald-500 hover:text-emerald-600 font-semibold underline underline-offset-2"
              onClick={() => switchMode(mode === "login" ? "signup" : mode === "signup" ? "login" : "login")}
            >
              {mode === "login" ? "Sign up free" : mode === "signup" ? "Log in" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
