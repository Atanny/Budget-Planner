"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  BudgetItem,
  UserSettings,
  BankAccount,
  BANK_TYPES,
  Cutoff,
  EXPENSE_CATEGORIES,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Check,
  Star,
  X,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

const MONTHS_LONG = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const CURRENT_MONTH = new Date().getMonth();
const CURRENT_YEAR  = new Date().getFullYear();

function DashboardPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [settings,  setSettings]  = useState<UserSettings | null>(null);
  const [items,     setItems]     = useState<BudgetItem[]>([]);
  const [payments,  setPayments]  = useState<Record<string, boolean[]>>({});
  const [banks,     setBanks]     = useState<BankAccount[]>([]);
  const [banksMap,  setBanksMap]  = useState<Record<string, string>>({});
  const [loading,   setLoading]   = useState(true);
  const [userName,  setUserName]  = useState("User");

  const [netHidden, setNetHidden] = useState(false);
  const [cardHidden, setCardHidden] = useState<Record<string, boolean>>({});
  const [paymentsHidden, setPaymentsHidden] = useState(false);

  // Hydrate hidden states from localStorage after mount (avoids Next.js SSR mismatch)
  useEffect(() => {
    try {
      if (localStorage.getItem("netHidden") === "true") setNetHidden(true);
      const stored = localStorage.getItem("cardHidden");
      if (stored) setCardHidden(JSON.parse(stored));
      if (localStorage.getItem("paymentsHidden") === "true") setPaymentsHidden(true);
    } catch {}
  }, []);

  const [userId, setUserId] = useState<string | null>(null);

  // Sahod modal
  const [showSahod,    setShowSahod]    = useState(false);
  const [sahodAmount,  setSahodAmount]  = useState("");
  const [sahodCutoff,  setSahodCutoff]  = useState<"1st" | "2nd">("1st");
  const [sahodExtra,   setSahodExtra]   = useState("");
  const [sahodSaving,  setSahodSaving]  = useState(false);
  const [sahodBankId,  setSahodBankId]  = useState<string>("");

  // Bank modal
  const [showBankForm,    setShowBankForm]    = useState(false);
  const [editBank,        setEditBank]        = useState<BankAccount | null>(null);
  const [confirmBankOpen, setConfirmBankOpen] = useState(false);
  const [confirmBankId,   setConfirmBankId]   = useState<string | null>(null);
  const [confirmBankName, setConfirmBankName] = useState("");

  // Budget view
  const [activeTab,       setActiveTab]       = useState<Cutoff>("1st");
  const [viewMonth,       setViewMonth]       = useState(CURRENT_MONTH);
  const [viewYear,        setViewYear]        = useState(CURRENT_YEAR);
  const [savingsCheck1st, setSavingsCheck1st] = useState(false);
  const [savingsCheck2nd, setSavingsCheck2nd] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthBtnRef = useRef<HTMLButtonElement>(null);
  const [monthPickerPos, setMonthPickerPos] = useState({ top: 0, right: 0 });
  const accountsScrollRef = useRef<HTMLDivElement>(null);
  const [payConfirmItem,  setPayConfirmItem]  = useState<BudgetItem | null>(null);
  const [paySelectedBank, setPaySelectedBank] = useState<string>("");
  const [openCardMenu, setOpenCardMenu] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const meta = user.user_metadata as Record<string,string> | undefined;
    setUserName(meta?.full_name || meta?.name || user.email?.split("@")[0] || "User");

    const [settRes, itemRes, payRes, bankRes] = await Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
      supabase.from("budget_items").select("*, loan_details(*)").eq("user_id", user.id).eq("is_active", true),
      supabase.from("monthly_payments").select("*").eq("user_id", user.id).eq("year", viewYear),
      supabase.from("bank_accounts").select("*").eq("user_id", user.id).eq("is_active", true).order("sort_order"),
    ]);

    setSettings(settRes.data);
    setItems(itemRes.data || []);
    
    // Build banks map
    const banksList = bankRes.data || [];
    setBanks(banksList);
    const bmap: Record<string, string> = {};
    for (const b of banksList) bmap[b.id] = b.name;
    setBanksMap(bmap);

    const map: Record<string, boolean[]> = {};
    for (const p of (payRes.data || [])) {
      if (!map[p.budget_item_id]) map[p.budget_item_id] = Array(12).fill(false);
      map[p.budget_item_id][p.month - 1] = p.paid;
    }
    setPayments(map);

    const savGoal = settRes.data?.savings_goal || 0;
    if (savGoal) {
      const { data: savData } = await supabase
        .from("monthly_savings").select("*")
        .eq("user_id", user.id).eq("year", viewYear).eq("month", viewMonth + 1)
        .maybeSingle();
      setSavingsCheck1st((savData?.kinsenas || 0) >= savGoal);
      setSavingsCheck2nd((savData?.atrenta || 0) >= savGoal);
    } else {
      setSavingsCheck1st(false);
      setSavingsCheck2nd(false);
    }
    setLoading(false);
  }, [viewYear, viewMonth]);

  useEffect(() => {
    if (!openCardMenu) return;
    const handler = () => setOpenCardMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openCardMenu]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get("action") === "sahod") {
      setShowSahod(true);
      router.replace("/");
    }
  }, [searchParams, router]);

  // ── Month nav ─────────────────────────────────────────────────────────────
  function goToPrevMonth() {
    setLoading(true);
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function goToNextMonth() {
    setLoading(true);
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // ── Payment toggle ────────────────────────────────────────────────────────
  async function togglePayment(item: BudgetItem, bankAccountId: string) {
    if (!userId) return;
    if (payments[item.id]?.[viewMonth]) return; // already paid
    const newArr = [...(payments[item.id] || Array(12).fill(false))];
    newArr[viewMonth] = true;
    setPayments(prev => ({ ...prev, [item.id]: newArr }));
    await supabase.from("monthly_payments").upsert({
      budget_item_id: item.id, user_id: userId,
      year: viewYear, month: viewMonth + 1,
      paid: true, paid_at: new Date().toISOString(),
    }, { onConflict: "budget_item_id,year,month" });
    
    // Deduct from selected bank
    if (bankAccountId) {
      await supabase.rpc("adjust_bank_balance", { p_id: bankAccountId, p_delta: -item.amount });
      // Refresh banks to show updated balance
      const { data: updatedBanks } = await supabase.from("bank_accounts").select("*").eq("user_id", userId).eq("is_active", true);
      if (updatedBanks) {
        setBanks(updatedBanks);
        const bmap: Record<string, string> = {};
        for (const b of updatedBanks) bmap[b.id] = b.name;
        setBanksMap(bmap);
      }
    }
    
    setPayConfirmItem(null);
    setPaySelectedBank("");
  }

  // ── Savings toggle ────────────────────────────────────────────────────────
  async function toggleSavings() {
    if (!userId) return;
    const is1st = activeTab === "1st";
    const cur = is1st ? savingsCheck1st : savingsCheck2nd;
    const newCheck = !cur;
    if (is1st) setSavingsCheck1st(newCheck); else setSavingsCheck2nd(newCheck);
    const goal = settings?.savings_goal || 0;
    await supabase.from("monthly_savings").upsert({
      user_id: userId, year: viewYear, month: viewMonth + 1,
      [is1st ? "kinsenas" : "atrenta"]: newCheck ? goal : 0,
    }, { onConflict: "user_id,year,month" });
  }

  // ── Sahod handler ────────────────────────────────────────────────────────
  async function handleSahod() {
    if (!userId || !sahodAmount) return;
    setSahodSaving(true);
    const amt   = parseFloat(sahodAmount);
    const extra = parseFloat(sahodExtra) || 0;
    const total = amt + extra;
    const targetBank = banks.find(b => b.id === sahodBankId) || banks.find(b => b.is_main_bank);
    if (targetBank) {
      const newBal = targetBank.balance + total;
      await supabase.from("bank_accounts").update({ balance: newBal }).eq("id", targetBank.id);
      setBanks(prev => prev.map(b => b.id === targetBank.id ? { ...b, balance: newBal } : b));
    }
    const prevTotal = settings?.total_salary_received || 0;
    const salaryField = sahodCutoff === "1st" ? "first_cutoff_salary" : "second_cutoff_salary";
    const extraField  = sahodCutoff === "1st" ? "extra_income_1st"    : "extra_income_2nd";
    await supabase.from("user_settings").update({
      total_salary_received: prevTotal + total, [salaryField]: amt, [extraField]: extra,
    }).eq("user_id", userId);
    setSettings(prev => prev ? { ...prev, total_salary_received: prevTotal + total, [salaryField]: amt, [extraField]: extra } : prev);
    setSahodSaving(false); setShowSahod(false); setSahodAmount(""); setSahodExtra(""); setSahodBankId("");
  }

  // ── Bank CRUD ─────────────────────────────────────────────────────────────
  async function saveBank(bank: Partial<BankAccount> & { name: string; type: string; balance: number; color: string; is_main_bank: boolean }) {
    if (!userId) return;
    if (bank.is_main_bank) {
      await supabase.from("bank_accounts").update({ is_main_bank: false }).eq("user_id", userId);
      setBanks(prev => prev.map(b => ({ ...b, is_main_bank: false })));
    }
    if (editBank) {
      const { data } = await supabase.from("bank_accounts").update(bank).eq("id", editBank.id).select().single();
      if (data) setBanks(prev => prev.map(b => b.id === editBank.id ? data : b));
    } else {
      const { data } = await supabase.from("bank_accounts").insert({ ...bank, user_id: userId }).select().single();
      if (data) setBanks(prev => [...prev, data]);
    }
    setShowBankForm(false); setEditBank(null);
  }

  function askDeleteBank(id: string, name: string) {
    setConfirmBankId(id); setConfirmBankName(name); setConfirmBankOpen(true);
  }

  async function doDeleteBank() {
    if (!confirmBankId) return;
    const id = confirmBankId;
    setConfirmBankOpen(false); setConfirmBankId(null);
    await supabase.from("bank_accounts").update({ is_active: false }).eq("id", id);
    setBanks(prev => prev.filter(b => b.id !== id));
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const netWorth      = (settings?.first_cutoff_salary || 0) + (settings?.second_cutoff_salary || 0);
  const mainBank      = banks.find(b => b.is_main_bank);
  const cutoffItems   = items.filter(i => i.cutoff === activeTab && i.status !== 'Suspended');
  const salary        = activeTab === "1st" ? (settings?.first_cutoff_salary || 0) : (settings?.second_cutoff_salary || 0);
  const extraIncome   = activeTab === "1st" ? (settings?.extra_income_1st || 0)    : (settings?.extra_income_2nd || 0);
  const totalIncome   = salary + extraIncome;
  const totalExpenses = cutoffItems.reduce((s, i) => s + i.amount, 0);
  const savingsChecked = activeTab === "1st" ? savingsCheck1st : savingsCheck2nd;
  const savingsGoal   = settings?.savings_goal || 0;
  const afterSavings  = totalIncome - totalExpenses - (savingsChecked ? savingsGoal : 0);

  if (loading) return (
    <div className="w-full flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  );

  /* ─────────────── shared button style ─────────────── */
  const sahodBtnStyle: React.CSSProperties = {
    background: "#2563EB", color: "white", border: "none", borderRadius: 24,
    padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
  };

  return (
    <div className="w-full pb-8">

      {/* ═══ DASHBOARD TITLE ═══════════════════════════════════════════════ */}
      <h1 style={{ fontSize: 28, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>
        Dashboard
      </h1>

      {/* ═══ HERO BANNER ═══════════════════════════════════════════════════ */}
      <div style={{
        borderRadius: 22, overflow: "visible", marginBottom: 22,
        background: "linear-gradient(130deg, #FF8B00 0%, #FF5500 100%)",
        border: "1.5px solid #0f172a", position: "relative", minHeight: 186,
        boxShadow: "0 4px 24px rgba(255,139,0,0.22)",
      }}>
        {/* Text / button */}
        <div style={{ padding: "20px 22px 22px", maxWidth: "calc(100% - 145px)", position: "relative", zIndex: 3 }}>
          <p style={{ color: "#FEF3C7", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            Welcome Back, {userName}
          </p>
          <div style={{ borderBottom: "1.5px solid rgba(255,255,255,0.35)", marginBottom: 12 }} />
          <h2 style={{ color: "white", fontSize: 30, fontWeight: 800, lineHeight: 1.1, marginBottom: 3 }}>
            Networth
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 14 }}>
            Your Monthly Salary
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <span style={{ color: "white", fontSize: 22, fontWeight: 700 }}>₱</span>
            <span style={{ color: "white", fontSize: 22, fontWeight: 700, letterSpacing: "0.14em" }}>
              {netHidden ? "••••••" : formatCurrency(netWorth).replace("₱", "").trim()}
            </span>
            <button
              onClick={() => {
                const v = !netHidden; setNetHidden(v);
                try { localStorage.setItem("netHidden", String(v)); } catch {}
              }}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              {netHidden ? <Eye size={16} color="white" /> : <EyeOff size={16} color="white" />}
            </button>
          </div>
          <button onClick={() => setShowSahod(true)} style={sahodBtnStyle}>
            <CreditCard size={14} /> May Sahod Na!
          </button>
        </div>

        {/* Person decoration */}
        <div style={{
          position: "absolute", right: 0, top: "-10px", bottom: 0, width: 200,
          display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "visible",
          pointerEvents: "none", zIndex: 2,
        }}>
          <img
            src="../Smiling man holding smartphone.png"
            alt=""
            style={{
              height: "115%", width: "auto", objectFit: "contain", objectPosition: "bottom",
              mixBlendMode: "lighten",
              filter: "drop-shadow(-4px 0 12px rgba(0,0,0,0.15))",
            }}
          />
        </div>
      </div>

      {/* ═══ ACCOUNTS HEADER ═══════════════════════════════════════════════ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 22, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, color: "var(--text-primary)" }}>Accounts</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
  onClick={() => {
    accountsScrollRef.current?.scrollBy({ left: -220, behavior: "smooth" });
  }}
  style={{
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "transparent",
    color: "#2563EB",
    border: "1.5px solid #2563EB",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  <ChevronLeft size={16} />
</button>

<button
  onClick={() => {
    accountsScrollRef.current?.scrollBy({ left: 220, behavior: "smooth" });
  }}
  style={{
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "transparent",
    color: "#2563EB",
    border: "1.5px solid #2563EB",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  <ChevronRight size={16} />
</button>
          <button onClick={() => { setEditBank(null); setShowBankForm(true); }} style={sahodBtnStyle}>
            <CreditCard size={14} /> Add Account
          </button>
        </div>
      </div>

      {/* ═══ ACCOUNT CARDS (horizontal scroll) ════════════════════════════ */}
      {openCardMenu && (() => {
        const bank = banks.find(b => b.id === openCardMenu);
        if (!bank) return null;
        const btn = document.getElementById(`card-menu-btn-${bank.id}`);
        const rect = btn?.getBoundingClientRect();
        if (!rect) return null;
        return (
          <div style={{ position: "fixed", top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right), zIndex: 9999, background: "white", border: "1.5px solid #0f172a", borderRadius: 12, boxShadow: "0 8px 28px rgba(15,23,42,0.22)", overflow: "hidden", minWidth: 170 }}>
            <button onClick={(e) => { e.stopPropagation(); setEditBank(bank); setShowBankForm(true); setOpenCardMenu(null); }}
              style={{ width: "100%", padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#1e40af", background: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f1f5f9" }}>
              <Edit2 size={13} color="#2563EB" /> Edit Account
            </button>
            <button onClick={(e) => { e.stopPropagation(); router.push("/budget"); setOpenCardMenu(null); }}
              style={{ width: "100%", padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#1e40af", background: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f1f5f9" }}>
              <CreditCard size={13} color="#2563EB" /> Go to Budget
            </button>
            <button onClick={(e) => { e.stopPropagation(); router.push("/loans"); setOpenCardMenu(null); }}
              style={{ width: "100%", padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#7c3aed", background: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f1f5f9" }}>
              <Star size={13} color="#7c3aed" /> Go to Loans
            </button>
            <button onClick={(e) => { e.stopPropagation(); askDeleteBank(bank.id, bank.name); setOpenCardMenu(null); }}
              style={{ width: "100%", padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#dc2626", background: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Trash2 size={13} color="#dc2626" /> Delete Account
            </button>
          </div>
        );
      })()}
      <div ref={accountsScrollRef} style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 22, scrollbarWidth: "none" }}>
        {banks.map(bank => {
          const typeInfo = BANK_TYPES.find(t => t.value === bank.type);
          const isHidden = cardHidden[bank.id] ?? false;
          const menuOpen = openCardMenu === bank.id;
          return (
            <div key={bank.id} style={{
              minWidth: 205, flexShrink: 0, borderRadius: 18,
              background: bank.color || "linear-gradient(145deg, #881520 0%, #9C1B28 100%)",
              border: "1.5px solid #0f172a", padding: "14px 14px 13px",
              position: "relative", boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
            }}>
              {/* 3-dot menu button */}
              <div style={{ position: "absolute", top: 8, right: 8 }}>
                <button
                  id={`card-menu-btn-${bank.id}`}
                  onClick={(e) => { e.stopPropagation(); setOpenCardMenu(menuOpen ? null : bank.id); }}
                  style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  {[0,1,2].map(i => <span key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "white", display: "block" }} />)}
                </button>
              </div>

              {/* Icon + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "rgba(0,0,0,0.25)", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontWeight: 800, fontSize: 16,
                }}>
                  {bank.name.charAt(0).toUpperCase()}
                </div>
                <p style={{ color: "white", fontWeight: 700, fontSize: 15 }}>{bank.name}</p>
                {bank.is_main_bank && (
                  <span style={{ background: "white", color: "#1d4ed8", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 12, whiteSpace: "nowrap", marginLeft: 2 }}>
                    Main Account
                  </span>
                )}
              </div>

              {/* Type */}
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 5 }}>
                {typeInfo?.value === "ewallet" ? "E-Wallet"
                  : typeInfo?.value === "bank" ? "Debit"
                  : typeInfo?.value === "cash" ? "Cash"
                  : typeInfo?.value === "investment" ? "Investment"
                  : "Other"} • PHP
              </p>
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", marginBottom: 8 }} />
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 6 }}>Balance</p>

              {/* Balance — individual hide */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "white", fontWeight: 700, fontSize: 17 }}>₱</span>
                <span style={{ color: "white", fontWeight: 700, fontSize: 17, letterSpacing: "0.1em" }}>
                  {isHidden ? "••••••" : formatCurrency(bank.balance).replace("₱", "").trim()}
                </span>
                <button
                  onClick={() => setCardHidden(prev => {
                    const next = { ...prev, [bank.id]: !isHidden };
                    try { localStorage.setItem("cardHidden", JSON.stringify(next)); } catch {}
                    return next;
                  })}
                  style={{ marginLeft: "auto", background: "rgba(255,255,255,0.14)", border: "none", borderRadius: 8, padding: "3px 7px", cursor: "pointer", display: "flex" }}>
                  {isHidden ? <Eye size={13} color="white" /> : <EyeOff size={13} color="white" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ FILTER ROW + MONTH NAV ════════════════════════════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {/* Category legend dots — centered */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          {[
            { label: "Loan",        color: "#7c3aed" },
            { label: "Maintenance", color: "#f97316" },
            { label: "Expense",     color: "#16a34a" },
          ].map(f => (
            <label key={f.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: f.color, display: "inline-block", flexShrink: 0 }} />
              {f.label}
            </label>
          ))}
        </div>
        {/* Month navigator — full width */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", overflow: "visible" }}>
          <button onClick={goToPrevMonth} style={{ width: 34, height: 34, borderRadius: "50%", background: "#2563EB", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ChevronLeft size={17} />
          </button>
          <button ref={monthBtnRef} onClick={() => {
              if (!showMonthPicker && monthBtnRef.current) {
                const r = monthBtnRef.current.getBoundingClientRect();
                setMonthPickerPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
              }
              setShowMonthPicker(v => !v);
            }}
            style={{ flex: 1, fontWeight: 700, fontSize: 16, color: "var(--text-primary)", textAlign: "center", background: showMonthPicker ? "#e0e7ff" : "#f8fafc", border: showMonthPicker ? "1.5px solid #2563EB" : "1.5px solid #e2e8f0", borderRadius: 10, padding: "6px 8px", cursor: "pointer", transition: "all 0.15s" }}>
            {MONTHS_LONG[viewMonth]}
          </button>
          <button onClick={goToNextMonth} style={{ width: 34, height: 34, borderRadius: "50%", background: "#2563EB", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ChevronRight size={17} />
          </button>
          {/* Month picker dropdown */}
          {showMonthPicker && (
            <div style={{ position: "fixed", top: monthPickerPos.top, left: 16, right: 16, zIndex: 9999, background: "white", border: "1.5px solid #0f172a", borderRadius: 14, boxShadow: "0 8px 28px rgba(15,23,42,0.16)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
                {MONTHS_LONG.map((m, i) => (
                  <button key={m} onClick={() => { setLoading(true); setViewMonth(i); setShowMonthPicker(false); }}
                    style={{
                      padding: "12px 4px", fontSize: 13, fontWeight: i === viewMonth ? 800 : 500, cursor: "pointer", border: "none",
                      background: i === viewMonth ? "#2563EB" : "white",
                      color: i === viewMonth ? "white" : "var(--text-primary)",
                      transition: "background 0.12s",
                      borderBottom: "1px solid #f1f5f9",
                      borderRight: "1px solid #f1f5f9",
                    }}
                    onMouseEnter={e => { if (i !== viewMonth) (e.target as HTMLButtonElement).style.background = "#eff6ff"; }}
                    onMouseLeave={e => { if (i !== viewMonth) (e.target as HTMLButtonElement).style.background = "white"; }}>
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ CUTOFF TABS ═══════════════════════════════════════════════════ */}
      <div style={{ display: "flex", borderRadius: 12, border: "1.5px solid #0f172a", overflow: "hidden", marginBottom: 14 }}>
        {(["1st", "2nd"] as Cutoff[]).map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "12px 0", fontWeight: 700, fontSize: 14,
              cursor: "pointer", border: "none",
              borderLeft: i > 0 ? "1.5px solid #0f172a" : "none",
              background: activeTab === tab ? "#2563EB" : "white",
              color: activeTab === tab ? "white" : "#2563EB",
              transition: "background 0.15s ease, color 0.15s ease",
            }}>
            {tab === "1st" ? "Kinsenas" : "Atrenta"}
          </button>
        ))}
      </div>

      {/* ═══ MONTHLY PAYMENTS ══════════════════════════════════════════════ */}
      <div style={{ borderRadius: 18, border: "1.5px solid #0f172a", overflow: "hidden", marginBottom: 14, boxShadow: "0 2px 14px rgba(15,23,42,0.07)" }}>

        {/* Header */}
        <div style={{ background: "#1a237e", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: "white", fontWeight: 800, fontSize: 17, flex: 1 }}>Monthly Payments</span>
          <span style={{ background: "rgba(255,255,255,0.18)", color: "white", borderRadius: 20, padding: "3px 13px", fontSize: 12, fontWeight: 700 }}>
            {cutoffItems.length} Items
          </span>
          <button
            onClick={() => setPaymentsHidden(v => { const next = !v; try { localStorage.setItem("paymentsHidden", String(next)); } catch {} return next; })}
            style={{ background: "#2563EB", color: "white", borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            {paymentsHidden ? <Eye size={12} /> : <EyeOff size={12} />}
            {paymentsHidden ? "Show All Payments" : "Hide All Payments"}
          </button>
        </div>

        {/* Rows */}
        {cutoffItems.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-faint)", fontSize: 14, background: "white" }}>
            No items yet — add them from the Budget page.
          </div>
        ) : cutoffItems.map(item => {
          const isPaid  = payments[item.id]?.[viewMonth] ?? false;
          const catInfo = EXPENSE_CATEGORIES.find(c => c.value === item.category);
          return (
            <div key={item.id} style={{
              padding: "12px 16px", borderBottom: "1px solid var(--border)",
              background: isPaid ? "#f0fdf4" : "white",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              {/* Colored dot */}
              <div style={{
                width: 11, height: 11, borderRadius: "50%", flexShrink: 0,
                background: isPaid ? "#16a34a"
                  : item.is_loan && ((item.loan_details as any)?.total_months >= 9999) ? "#f97316"
                  : item.is_loan ? "#7c3aed"
                  : "#16a34a",
              }} />

              {/* Name + category */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: isPaid ? "var(--text-muted)" : "var(--brand)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  {catInfo?.label.split(" ").slice(1).join(" ") || item.category || "General"}
                </p>
              </div>

              {/* Amount — toggled by hide/show */}
              <span style={{ color: paymentsHidden ? "var(--text-faint)" : "#dc2626", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", flexShrink: 0 }}>
                {paymentsHidden ? "₱ ••••••" : formatCurrency(item.amount)}
              </span>

              {/* Mark as Paid / Paid */}
              <button
                onClick={() => !isPaid && setPayConfirmItem(item)}
                disabled={isPaid}
                style={{
                  flexShrink: 0,
                  background: isPaid ? "rgba(22,163,74,0.1)" : "#2563EB",
                  color: isPaid ? "#16a34a" : "white",
                  border: isPaid ? "1.5px solid #16a34a" : "none",
                  borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 700,
                  cursor: isPaid ? "default" : "pointer",
                  display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                }}>
                <Check size={12} /> {isPaid ? "Paid" : "Mark as Paid"}
              </button>
            </div>
          );
        })}

        {/* Savings check row */}
        <div style={{
          padding: "12px 16px", borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "white", flexWrap: "wrap", gap: 8,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
            Do you have Saving for the cutoff Today?
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
            Deduct {formatCurrency(savingsGoal)} from Remaining
            <input type="checkbox" checked={savingsChecked} onChange={toggleSavings}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#2563EB" }} />
          </label>
        </div>

        {/* Income / Expenses / Savings / Remaining */}
        <div style={{ borderTop: "2px solid #FFE0B2", background: "#FFF8F0" }}>
          {[
            { label: "Income",    value: totalIncome,    show: true },
            { label: "Expenses",  value: totalExpenses,  show: true },
            { label: "Savings",   value: savingsChecked ? savingsGoal : 0, show: savingsChecked },
            { label: "Remaining", value: afterSavings,   show: true },
          ].filter(r => r.show).map((row, i, arr) => (
            <div key={row.label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px",
              borderBottom: i < arr.length - 1 ? "1px solid #FFE0B2" : "none",
            }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--brand)" }}>{row.label}</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: row.label === "Savings" ? "#f59e0b" : row.label === "Remaining" && afterSavings < 0 ? "#dc2626" : "#2563EB" }}>
                {row.label === "Savings" ? `- ${formatCurrency(row.value)}` : formatCurrency(row.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ PAY CONFIRM MODAL WITH BANK SELECTION ═════════════════════════════ */}
      {payConfirmItem && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.45)", backdropFilter: "blur(8px)", padding: 16 }}>
          <div className="slide-up" style={{ width: "100%", maxWidth: 360, borderRadius: 20, overflow: "hidden", background: "white", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.18)" }}>
            <div style={{ padding: "22px 20px 16px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#dcfce7", border: "2px solid #0f172a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Check size={22} color="var(--brand-dark)" strokeWidth={3} />
              </div>
              <h2 style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>Mark as Paid?</h2>
              <p style={{ fontSize: 14, marginTop: 6, fontWeight: 600, color: "var(--text-secondary)" }}>
                {payConfirmItem.name} — {formatCurrency(payConfirmItem.amount)}
              </p>
            </div>
            
            {/* Bank Selection */}
            <div style={{ margin: "0 20px 16px" }}>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>
                Deduct from which account?
              </label>
              <select
                value={paySelectedBank}
                onChange={(e) => setPaySelectedBank(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontSize: 14,
                  border: "1.5px solid #0f172a",
                  background: "var(--bg-subtle)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              >
                <option value="">Select bank account...</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name} — {formatCurrency(bank.balance)}
                  </option>
                ))}
              </select>
              {payConfirmItem.bank_account_id && (
                <p style={{ fontSize: 11, marginTop: 6, color: "var(--text-muted)" }}>
                  Default: {banksMap[payConfirmItem.bank_account_id] || "Linked bank"}
                </p>
              )}
            </div>

            <div style={{ margin: "0 20px 16px", padding: "12px", borderRadius: 12, background: "#fef9c3", border: "1px solid #0f172a" }}>
              <p style={{ fontSize: 12, fontWeight: 700, textAlign: "center", color: "#854d0e" }}>⚠️ This will deduct {formatCurrency(payConfirmItem.amount)} from the selected account</p>
            </div>
            <div style={{ padding: "0 20px 20px", display: "flex", gap: 12 }}>
              <button onClick={() => { setPayConfirmItem(null); setPaySelectedBank(""); }} style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, background: "var(--brand-pale)", color: "var(--brand-dark)", border: "1.5px solid #0f172a", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  const bankId = paySelectedBank || payConfirmItem.bank_account_id;
                  if (!bankId) {
                    alert("Please select a bank account");
                    return;
                  }
                  togglePayment(payConfirmItem, bankId);
                }}
                disabled={!paySelectedBank && !payConfirmItem.bank_account_id}
                style={{ 
                  flex: 1, 
                  padding: "11px 0", 
                  borderRadius: 12, 
                  fontSize: 14, 
                  fontWeight: 700, 
                  background: "linear-gradient(135deg, var(--brand-dark), var(--brand-light))", 
                  color: "white", 
                  border: "none", 
                  cursor: "pointer",
                  opacity: (!paySelectedBank && !payConfirmItem.bank_account_id) ? 0.5 : 1,
                }}>
                Yes, Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SAHOD MODAL ═══════════════════════════════════════════════════ */}
      {showSahod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="w-full max-w-sm slide-up rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.16)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
              <div>
                <h2 className="font-bold" style={{ color: "#1e3a5f" }}>💸 May Sahod Na!</h2>
                <p className="text-xs mt-0.5" style={{ color: "#3b82f6" }}>Choose where to add your salary</p>
              </div>
              <button onClick={() => setShowSahod(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
                <X size={17} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Which Cutoff?</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ label: "1st Cutoff (15th)", val: "1st" as const, salary: settings?.first_cutoff_salary || 0 },
                    { label: "2nd Cutoff (30th)", val: "2nd" as const, salary: settings?.second_cutoff_salary || 0 }].map(opt => (
                    <button key={opt.val} onClick={() => { setSahodCutoff(opt.val); setSahodAmount(opt.salary.toString()); }}
                      className="p-2.5 rounded-xl text-center transition-all"
                      style={{ background: sahodCutoff === opt.val ? "#dbeafe" : "var(--bg-subtle)", border: `1.5px solid ${sahodCutoff === opt.val ? "#93c5fd" : "var(--border)"}` }}>
                      <p className="text-xs font-bold" style={{ color: "#1d4ed8" }}>{opt.label}</p>
                      <p className="text-sm font-bold font-mono" style={{ color: "#2563eb" }}>{formatCurrency(opt.salary)}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Add to Account</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {banks.map(b => {
                    const selected = sahodBankId ? sahodBankId === b.id : b.is_main_bank;
                    return (
                      <button key={b.id} onClick={() => setSahodBankId(b.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${selected ? "#2563EB" : "var(--border)"}`, background: selected ? "#eff6ff" : "var(--bg-subtle)", cursor: "pointer", transition: "all 0.15s", textAlign: "left" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: selected ? "#1d4ed8" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</p>
                          <p style={{ fontSize: 11, color: "var(--text-faint)" }}>{b.type} {b.is_main_bank ? "· Main" : ""}</p>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>{formatCurrency(b.balance)}</span>
                        {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Salary Amount (₱)</label>
                <input type="number" value={sahodAmount} onChange={e => setSahodAmount(e.target.value)} placeholder="Enter sahod amount..." className="w-full px-3 py-2.5 text-sm" autoFocus />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                  Extra Income (₱) <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>— optional</span>
                </label>
                <input type="number" value={sahodExtra} onChange={e => setSahodExtra(e.target.value)} placeholder="Bonus, allowance, etc..." className="w-full px-3 py-2.5 text-sm" />
              </div>
              {(parseFloat(sahodAmount) > 0 || parseFloat(sahodExtra) > 0) && (() => {
                const targetBank = banks.find(b => b.id === sahodBankId) || banks.find(b => b.is_main_bank);
                return (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", border: "1.5px solid #0f172a" }}>
                    <span style={{ color: "var(--text-muted)" }}>Total adding to <strong>{targetBank?.name || "account"}</strong></span>
                    <span className="font-bold font-mono" style={{ color: "#2563eb" }}>
                      {formatCurrency((parseFloat(sahodAmount) || 0) + (parseFloat(sahodExtra) || 0))}
                    </span>
                  </div>
                );
              })()}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setShowSahod(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1.5px solid #0f172a" }}>
                Cancel
              </button>
              <button onClick={handleSahod} disabled={!sahodAmount || sahodSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}>
                {sahodSaving ? "Adding..." : "Add Sahod 💸"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BANK FORM MODAL ═══════════════════════════════════════════════ */}
      {showBankForm && (
        <BankFormModal
          bank={editBank}
          onClose={() => { setShowBankForm(false); setEditBank(null); }}
          onSave={saveBank}
        />
      )}

      <ConfirmModal
        isOpen={confirmBankOpen}
        title="Remove Account"
        message={`Remove "${confirmBankName}" from your accounts? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={doDeleteBank}
        onCancel={() => { setConfirmBankOpen(false); setConfirmBankId(null); }}
      />
    </div>
  );
}

/* ── BankFormModal ────────────────────────────────────────────────────────── */
function BankFormModal({ bank, onClose, onSave }: {
  bank: BankAccount | null;
  onClose: () => void;
  onSave: (b: any) => void;
}) {
  const [name,    setName]    = useState(bank?.name || "");
  const [type,    setType]    = useState<"bank" | "ewallet" | "cash" | "investment" | "other">(bank?.type || "bank");
  const [balance, setBalance] = useState(bank?.balance?.toString() || "");
  const [color,   setColor]   = useState(bank?.color || "#881520");
  const [isMain,  setIsMain]  = useState(bank?.is_main_bank || false);

  const COLORS = ["#881520","#1a3a8f","#1a5c3a","#1a4a6e","#6b1a6e","#7a4000","#1a3a5c","#2d6a2d","#b45309","#0f4c75","#3d3d3d","#1e3a4a"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
      <div className="w-full max-w-sm slide-up rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.16)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#0f172a", background: "var(--brand-pale)" }}>
          <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>{bank ? "Edit Account" : "Add Account"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><X size={17} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Account Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GCash, BDO Savings, BPI..." className="w-full px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              {BANK_TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value)} className="p-2.5 rounded-xl text-center transition-all"
                  style={{ background: type === t.value ? `${t.color}18` : "var(--bg-subtle)", border: `1.5px solid ${type === t.value ? t.color : "var(--border)"}` }}>
                  <p style={{ fontSize: 16 }}>{t.label.split(" ")[0]}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: type === t.value ? t.color : "var(--text-faint)" }}>{t.label.split(" ").slice(1).join(" ")}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Current Balance (₱)</label>
            <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 text-sm" />
          </div>
          <button onClick={() => setIsMain(!isMain)} className="w-full flex items-center justify-between p-3 rounded-xl transition-all"
            style={{ background: isMain ? "#dbeafe" : "var(--bg-subtle)", border: `1.5px solid ${isMain ? "#93c5fd" : "var(--border)"}` }}>
            <div className="flex items-center gap-2.5">
              <Star size={16} style={{ color: isMain ? "#2563eb" : "var(--text-faint)" }} fill={isMain ? "#2563eb" : "none"} />
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: isMain ? "#1d4ed8" : "var(--text-primary)" }}>Set as Main Bank</p>
                <p className="text-xs" style={{ color: isMain ? "#3b82f6" : "var(--text-faint)" }}>Where your salary (sahod) goes</p>
              </div>
            </div>
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: isMain ? "#2563eb" : "var(--bg-subtle)", border: `2px solid ${isMain ? "#2563eb" : "var(--border-strong)"}` }}>
              {isMain && <Check size={11} className="text-white" />}
            </div>
          </button>
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--text-secondary)" }}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full transition-all"
                  style={{ background: c, border: `3px solid ${color === c ? "var(--text-primary)" : "transparent"}`, outline: `2px solid ${color === c ? c : "transparent"}`, outlineOffset: 2 }} />
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1.5px solid #0f172a" }}>Cancel</button>
          <button onClick={() => onSave({ name, type, balance: parseFloat(balance) || 0, color, is_main_bank: isMain })} disabled={!name} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-light))" }}>
            {bank ? "Save Changes" : "Add Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="w-full flex items-center justify-center h-64"><div className="spinner" /></div>}>
      <DashboardPageInner />
    </Suspense>
  );
}