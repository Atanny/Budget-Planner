"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  BudgetItem,
  UserSettings,
  SalaryHistory,
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
  MoreVertical,
  Upload,
  ReceiptText,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import FloatingMenu from "@/components/FloatingMenu";

const MONTHS_LONG = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const CURRENT_MONTH = new Date().getMonth();
const CURRENT_YEAR  = new Date().getFullYear();

type PaymentState = Record<string, Record<number, { paid: boolean; receipt_url?: string }>>;

function getLoanMonthScope(item: BudgetItem, year: number): { start: number; end: number } | null {
  if (!item.is_loan) return null;
  const ld = (item as any).loan_details?.[0] ?? (item as any).loan_details;
  if (!ld?.start_date || !ld?.total_months) return null;
  const totalM = parseInt(ld.total_months);
  const loanStart = new Date(ld.start_date);
  if (totalM >= 9999) {
    if (loanStart.getFullYear() > year) return null;
    const startM = loanStart.getFullYear() < year ? 0 : loanStart.getMonth();
    return { start: startM, end: 11 };
  }
  const loanEndDate = new Date(loanStart);
  loanEndDate.setMonth(loanEndDate.getMonth() + totalM - 1);
  if (loanStart.getFullYear() > year) return null;
  if (loanEndDate.getFullYear() < year) return null;
  const startM = loanStart.getFullYear() < year ? 0 : loanStart.getMonth();
  const endM   = loanEndDate.getFullYear() > year ? 11 : loanEndDate.getMonth();
  return { start: startM, end: endM };
}

function isItemVisibleInMonth(item: BudgetItem, month: number, year: number): boolean {
  if (item.is_loan) {
    const scope = getLoanMonthScope(item, year);
    if (!scope) return false;
    return month >= scope.start && month <= scope.end;
  }
  if (!item.created_at) return true;
  const created = new Date(item.created_at);
  const createdYear  = created.getFullYear();
  const createdMonth = created.getMonth();
  if (item.status === 'Once') return createdYear === year && createdMonth === month;
  if (year < createdYear) return false;
  if (year === createdYear && month < createdMonth) return false;
  return true;
}

function DashboardPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [settings,      setSettings]      = useState<UserSettings | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory | null>(null);
  const [items,         setItems]         = useState<BudgetItem[]>([]);
  const [payments,  setPayments]  = useState<PaymentState>({});
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
  const [dashReceiptItem, setDashReceiptItem] = useState<BudgetItem | null>(null);

  // Bank-to-bank transfer modal
  const [showTransfer,   setShowTransfer]   = useState(false);
  const [transferFromId, setTransferFromId] = useState<string>("");
  const [transferToId,   setTransferToId]   = useState<string>("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote,   setTransferNote]   = useState("");
  const [transferSaving, setTransferSaving] = useState(false);

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
  const [openItemMenu, setOpenItemMenu] = useState<string | null>(null)
  const [paySelectedBank, setPaySelectedBank] = useState<string>("");
  const [payAlreadyPaid,  setPayAlreadyPaid]  = useState<boolean | null>(null);
  const [payTransferFee,  setPayTransferFee]  = useState<string>("");
  const [receiptFile,     setReceiptFile]     = useState<File | null>(null);
  const [receiptPreview,  setReceiptPreview]  = useState<string | null>(null);
  const [openCardMenu, setOpenCardMenu] = useState<string | null>(null);

  const isMonthPaid = (itemId: string, month: number) => payments[itemId]?.[month]?.paid ?? false;
  const getMonthReceipt = (itemId: string, month: number) => payments[itemId]?.[month]?.receipt_url || '';

  // ── Data loading ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { setLoading(false); return; }
  setUserId(user.id);
  const meta = user.user_metadata as Record<string,string> | undefined;
  setUserName(meta?.full_name || meta?.name || user.email?.split("@")[0] || "User");

  const [settRes, itemRes, payRes, bankRes, salHistRes] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
    supabase.from("budget_items").select("*, loan_details(*)").eq("user_id", user.id).eq("is_active", true),
    supabase.from("monthly_payments").select("*").eq("user_id", user.id).eq("year", viewYear),
    supabase.from("bank_accounts").select("*").eq("user_id", user.id).eq("is_active", true).order("sort_order"),
    supabase.from("salary_history").select("*").eq("user_id", user.id).eq("year", viewYear).eq("month", viewMonth + 1).maybeSingle(),
  ]);

  setSettings(settRes.data);
  setSalaryHistory(salHistRes.data ?? null);
  setItems(itemRes.data || []);
  
  // Build banks map
  let banksList = bankRes.data || [];

  // Auto-create CASH account if not present
  const hasCash = banksList.some(b => b.type === 'cash' && b.name === 'Cash');
  if (!hasCash) {
    const { data: cashAcct } = await supabase.from('bank_accounts').insert({
      user_id: user.id,
      name: 'Cash',
      type: 'cash',
      balance: 0,
      color: '#16a34a',
      category: 'Cash',
      is_active: true,
      sort_order: 0,
      is_main_bank: false,
      is_required: true,
    }).select().single();
    if (cashAcct) banksList = [cashAcct, ...banksList];
  }

  setBanks(banksList);
  const bmap: Record<string, string> = {};
  for (const b of banksList) bmap[b.id] = b.name;
  setBanksMap(bmap);

  // UPDATED: Store receipt_url with payment status
  const map: PaymentState = {};
  for (const p of (payRes.data || [])) {
    if (!map[p.budget_item_id]) map[p.budget_item_id] = {};
    map[p.budget_item_id][p.month] = {
      paid: p.paid,
      receipt_url: p.receipt_url
    };
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
    if (searchParams.get("action") === "transfer") {
      setTransferFromId(""); setTransferToId(""); setTransferAmount(""); setTransferNote("");
      setShowTransfer(true);
      router.replace("/");
    }
  }, [searchParams, router]);


  useEffect(() => {
  if (!openItemMenu) return;
  const handler = () => setOpenItemMenu(null);
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
  }, [openItemMenu]);


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
  async function togglePayment(item: BudgetItem, bankAccountId: string, totalDeduct?: number, receiptFile?: File | null) {
  if (!userId) return;
  const month1 = viewMonth + 1;
  
  // Upload receipt if provided
  let receiptUrl = null;
  if (receiptFile) {
    const fileExt = receiptFile.name.split('.').pop();
    const fileName = `${userId}/${item.id}/${viewYear}-${month1}-${Date.now()}.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, receiptFile);
    
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);
      receiptUrl = urlData.publicUrl;
    }
  }

  setPayments(prev => ({
    ...prev,
    [item.id]: {
      ...(prev[item.id] || {}),
      [month1]: { paid: true, receipt_url: receiptUrl || undefined },
    },
  }));
  
  await supabase.from("monthly_payments").upsert({
    budget_item_id: item.id, 
    user_id: userId,
    year: viewYear, 
    month: month1,
    paid: true, 
    paid_at: new Date().toISOString(),
    receipt_url: receiptUrl
  }, { onConflict: "budget_item_id,year,month" });
  
  if (bankAccountId) {
    const deduct = totalDeduct ?? item.amount;
    await supabase.rpc("adjust_bank_balance", { p_id: bankAccountId, p_delta: -deduct });
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
  setPayTransferFee("");
  setReceiptFile(null);
  setReceiptPreview(null);
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

    // Determine target bank — default to main bank if none selected
    const targetBank = banks.find(b => b.id === sahodBankId) || banks.find(b => b.is_main_bank);
    if (targetBank) {
      const newBal = targetBank.balance + total;
      await supabase.from("bank_accounts").update({ balance: newBal }).eq("id", targetBank.id);
      setBanks(prev => prev.map(b => b.id === targetBank.id ? { ...b, balance: newBal } : b));
    }

    // Only update salary figures when money goes into the MAIN bank account
    if (targetBank?.is_main_bank) {
      const prevTotal = settings?.total_salary_received || 0;

      // Get the specific cutoff being paid (1st or 2nd)
      const salaryField = sahodCutoff === "1st" ? "first_cutoff_salary" : "second_cutoff_salary";
      const extraField  = sahodCutoff === "1st" ? "extra_income_1st"    : "extra_income_2nd";

      // Get existing salary history for this month, or null if not exists
      const { data: existingHist } = await supabase
        .from("salary_history")
        .select("*")
        .eq("user_id", userId)
        .eq("year", viewYear)
        .eq("month", viewMonth + 1)
        .maybeSingle();

      // Build the payload - ONLY update the specific cutoff being paid
      // Keep the other cutoff's value from existing history or settings
      const histPayload = {
        user_id:              userId,
        year:                 viewYear,
        month:                viewMonth + 1,
        first_cutoff_salary:  salaryField === "first_cutoff_salary"  
          ? amt 
          : (existingHist?.first_cutoff_salary ?? settings?.first_cutoff_salary ?? 0),
        second_cutoff_salary: salaryField === "second_cutoff_salary" 
          ? amt 
          : (existingHist?.second_cutoff_salary ?? settings?.second_cutoff_salary ?? 0),
        extra_income_1st:     extraField === "extra_income_1st"     
          ? extra 
          : (existingHist?.extra_income_1st ?? settings?.extra_income_1st ?? 0),
        extra_income_2nd:     extraField === "extra_income_2nd"     
          ? extra 
          : (existingHist?.extra_income_2nd ?? settings?.extra_income_2nd ?? 0),
        savings_goal:         existingHist?.savings_goal ?? settings?.savings_goal ?? 500,
      };

      const { data: histData } = await supabase
        .from("salary_history")
        .upsert(histPayload, { onConflict: "user_id,year,month" })
        .select()
        .single();

      // Only update the running total in user_settings — NOT the salary placeholder fields
      await supabase.from("user_settings").update({
        total_salary_received: prevTotal + total,
      }).eq("user_id", userId);

      setSalaryHistory(histData ?? null);
      setSettings(prev => prev ? { ...prev, total_salary_received: prevTotal + total } : prev);
    }
    // If non-main bank: balance is updated above but salary totals stay unchanged

    setSahodSaving(false); 
    setShowSahod(false); 
    setSahodAmount(""); 
    setSahodExtra(""); 
    setSahodBankId("");
  }

  async function handleTransfer() {
    if (!userId || !transferFromId || !transferToId || !transferAmount) return;
    if (transferFromId === transferToId) return;
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) return;
    setTransferSaving(true);

    const fromBank = banks.find(b => b.id === transferFromId);
    const toBank   = banks.find(b => b.id === transferToId);
    if (!fromBank || !toBank) { setTransferSaving(false); return; }

    const newFrom = fromBank.balance - amt;
    const newTo   = toBank.balance   + amt;

    await Promise.all([
      supabase.from("bank_accounts").update({ balance: newFrom }).eq("id", transferFromId),
      supabase.from("bank_accounts").update({ balance: newTo   }).eq("id", transferToId),
    ]);

    setBanks(prev => prev.map(b =>
      b.id === transferFromId ? { ...b, balance: newFrom } :
      b.id === transferToId   ? { ...b, balance: newTo   } : b
    ));

    // Log to transaction_logs
    await supabase.from("transaction_logs").insert({
      user_id:    userId,
      action:     "add",
      item_name:  `Transfer: ${fromBank.name} → ${toBank.name}`,
      amount:     amt,
      category:   "Transfer",
      notes:      transferNote || null,
      created_at: new Date().toISOString(),
    });

    setTransferSaving(false);
    setShowTransfer(false);
    setTransferFromId("");
    setTransferToId("");
    setTransferAmount("");
    setTransferNote("");
  }async function saveBank(bank: Partial<BankAccount> & { name: string; type: string; balance: number; color: string; is_main_bank: boolean }) {
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
    const bank = banks.find(b => b.id === id);
    if (bank?.is_required || bank?.name === 'Cash') {
      alert('The Cash account is required and cannot be deleted.');
      return;
    }
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
  // Use month-specific salary_history if it exists, otherwise fall back to global user_settings default
  const activeSalary  = salaryHistory ?? settings;
  const netWorth      = (activeSalary?.first_cutoff_salary || 0) + (activeSalary?.second_cutoff_salary || 0);
  const mainBank      = banks.find(b => b.is_main_bank);
  const cutoffItems   = items.filter(i =>
    i.cutoff === activeTab &&
    i.status !== 'Suspended' &&
    isItemVisibleInMonth(i, viewMonth, viewYear)
  );
  const salary        = activeTab === "1st" ? (activeSalary?.first_cutoff_salary || 0) : (activeSalary?.second_cutoff_salary || 0);
  const extraIncome   = activeTab === "1st" ? (activeSalary?.extra_income_1st || 0)    : (activeSalary?.extra_income_2nd || 0);
  const totalIncome   = salary + extraIncome;
  const totalExpenses = cutoffItems.reduce((s, i) => s + i.amount, 0);
  const unpaidExpenses = cutoffItems.filter(i => !isMonthPaid(i.id, viewMonth + 1)).reduce((s, i) => s + i.amount, 0);
  const savingsChecked = activeTab === "1st" ? savingsCheck1st : savingsCheck2nd;
  const savingsGoal   = activeSalary?.savings_goal || 0;
  const afterSavings  = totalIncome - unpaidExpenses - (savingsChecked ? savingsGoal : 0);

  if (loading) return (
    <div className="w-full flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  );

  /* ─────────────── shared button style ─────────────── */
  const sahodBtnStyle: React.CSSProperties = {
    background: "#2563EB", color: "white", border: "none", borderRadius: 999,
    padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
  };

  return (
    <div className="w-full pb-8">

      {/* ═══ DASHBOARD TITLE ═══════════════════════════════════════════════ */}
      <h1 style={{ fontSize: 28, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, marginBottom: 14, color: "var(--text-primary)" }}>
        Home
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
          <h2 style={{ color: "white", fontSize: 30, marginBottom: 3, letterSpacing:1 }}>
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
      <FloatingMenu
        isOpen={!!openCardMenu}
        anchorId={openCardMenu ? `card-menu-btn-${openCardMenu}` : 'dashboard-card-menu-anchor'}
        minWidth={170}
        onClose={() => setOpenCardMenu(null)}
      >
        {(() => {
          const bank = banks.find(b => b.id === openCardMenu);
          if (!bank) return null;
          const isCashRequired = bank.is_required || bank.name === 'Cash';
          return (
            <>
              <button onClick={(e) => { e.stopPropagation(); setEditBank(bank); setShowBankForm(true); setOpenCardMenu(null); }}
                style={{ width: "100%", padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#1e40af", background: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f1f5f9", fontFamily: "'Poppins', sans-serif" }}>
                <Edit2 size={13} color="#2563EB" /> Edit Account
              </button>
              <button onClick={(e) => { e.stopPropagation(); setTransferFromId(bank.id); setTransferToId(""); setTransferAmount(""); setTransferNote(""); setShowTransfer(true); setOpenCardMenu(null); }}
                style={{ width: "100%", padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#16a34a", background: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: isCashRequired ? "none" : "1px solid #f1f5f9", fontFamily: "'Poppins', sans-serif" }}>
                <span style={{ fontSize: 13 }}>⇄</span> Transfer Money
              </button>
              {!isCashRequired && (
                <button onClick={(e) => { e.stopPropagation(); askDeleteBank(bank.id, bank.name); setOpenCardMenu(null); }}
                  style={{ width: "100%", padding: "11px 16px", fontSize: 13, fontWeight: 600, color: "#dc2626", background: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "'Poppins', sans-serif" }}>
                  <Trash2 size={13} color="#dc2626" /> Delete Account
                </button>
              )}
            </>
          );
        })()}
      </FloatingMenu>
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
                  <span style={{ background: "rgba(255,255,255,0.18)", color: "white", borderRadius: 20, padding: "3px 13px", fontSize: 8, fontWeight: 700 }}>
                    Main
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
    <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14
  }}
>
  {/* LEFT: TITLE */}
  <h2
    style={{
      fontSize: 22,
      fontFamily: "Helvetica, Arial, sans-serif",
      fontWeight: 700,
      color: "var(--text-primary)",
      margin: 0
    }}
  >
    Cutoff Payments
  </h2>

  {/* RIGHT: CONTROLS */}
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

    <button
      ref={monthBtnRef}
      onClick={() => {
        if (!showMonthPicker && monthBtnRef.current) {
          const r = monthBtnRef.current.getBoundingClientRect();

          setMonthPickerPos({
            top: r.bottom + 8,
            right: Math.max(8, window.innerWidth - r.right)
          });
        }
        setShowMonthPicker(v => !v);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontWeight: 700,
        fontSize: 12,
        color: "var(--text-primary)",
        background: "#fff",
        border: showMonthPicker ? "1px solid #2563EB" : "1px solid #E5E7EB",
        borderRadius: 20,
        padding: "7px 14px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        width: "fit-content",
        whiteSpace: "nowrap",
        gap: 6
      }}
    >
      {MONTHS_LONG[viewMonth]}{" "}
      {viewYear !== CURRENT_YEAR ? viewYear : ""}
    </button>

    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <button
        onClick={goToPrevMonth}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "#2563EB",
          color: "white",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <ChevronLeft size={17} />
      </button>

      <button
        onClick={goToNextMonth}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "#2563EB",
          color: "white",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <ChevronRight size={17} />
      </button>
    </div>

    {showMonthPicker && (
      <MonthPickerDropdown
        top={monthPickerPos.top}
        right={monthPickerPos.right}
        viewMonth={viewMonth}
        onSelect={(i) => {
          setLoading(true);
          setViewMonth(i);
          setShowMonthPicker(false);
        }}
        onClose={() => setShowMonthPicker(false)}
      />
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
        <div style={{ background: "#1a237e", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent:'space-between'}}>
         
          <span style={{ background: "rgba(255,255,255,0.18)", color: "white", borderRadius: 20, padding: "3px 13px", fontSize: 12, fontWeight: 700 }}>
            {cutoffItems.length} Items
          </span>
          <button
  onClick={() =>
    setPaymentsHidden(v => {
      const next = !v
      try {
        localStorage.setItem("paymentsHidden", String(next))
      } catch {}
      return next
    })
  }
  style={{
    background: "#2563EB",
    color: "#fff",
    borderRadius: 20,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    display: "inline-flex",   // ✅ hug content
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",     // ✅ prevent wrap
    transition: "all 0.15s ease"
  }}
>
  {paymentsHidden ? <Eye size={12} /> : <EyeOff size={12} />}
  {paymentsHidden ? "Show All Payments" : "Hide All Payments"}
</button>
        </div>

       {/* Rows */}
       <div style={{ display: "flex", gap: 10, justifyContent: "start" }}>
          {[
            { label: "Loan",        color: "#7c3aed" },
            { label: "Maintenance", color: "#f97316" },
            { label: "Expense",     color: "#16a34a" },
          ].map(f => (
            <label className="my-3 mx-4" key={f.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: f.color, display: "inline-block", flexShrink: 0 }} />
              {f.label}
            </label>
          ))}
        </div>

{cutoffItems.length === 0 ? (
  <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-faint)", fontSize: 14, background: "white" }}>
    No items yet — add them from the Budget page.
  </div>
  
) : [...cutoffItems].sort((a, b) => {
  const aPaid = isMonthPaid(a.id, viewMonth + 1) ? 1 : 0;
  const bPaid = isMonthPaid(b.id, viewMonth + 1) ? 1 : 0;
  return aPaid - bPaid;
}).map(item => {
  const isPaid  = isMonthPaid(item.id, viewMonth + 1);
  const catInfo = EXPENSE_CATEGORIES.find(c => c.value === item.category);
  const isUnlimitedLoan = item.is_loan && ((item.loan_details as any)?.total_months >= 9999);
  return (
    <div key={item.id} style={{
      padding: "12px 16px", borderBottom: "1px solid var(--border)",
      background: isPaid ? "#f0fdf4" : "white",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      {/* Colored dot — always shows item type, not paid status */}
      <div style={{
        width: 11, height: 11, borderRadius: "50%", flexShrink: 0,
        background: isUnlimitedLoan ? "#f97316"
          : item.is_loan ? "#7c3aed"
          : "#16a34a",
      }} />

      {/* Name + category */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 15, color: isPaid ? "var(--text-muted)" : "var(--brand)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name}
        </p>
        <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
          {item.is_loan ? (isUnlimitedLoan ? 'Maintenance' : 'Loan') : catInfo?.label.split(" ").slice(1).join(" ") || item.category || "General"} • {item.cutoff === '1st' ? '1st Cutoff · 15th' : '2nd Cutoff · 30th'} • {MONTHS_LONG[viewMonth]} {item.cutoff === '1st' ? '15' : '30'}, {viewYear}
        </p>
      </div>

      {/* Amount + paid check — price on top, checkmark below */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: 3 }}>
        <span style={{ color: isPaid ? "#94a3b8" : "#dc2626", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textDecoration: isPaid ? "line-through" : "none" }}>
          {paymentsHidden ? "₱ ••••••" : formatCurrency(item.amount)}
        </span>
        {isPaid && (
          <span style={{ color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            <Check size={11} color="#16a34a" strokeWidth={3} />
          </span>
        )}
      </div>

      {/* 3-Dot Menu */}
<div style={{ position: 'relative' }}>
  <button
    id={`dashboard-item-menu-btn-${item.id}`}
    onClick={(e) => { e.stopPropagation(); setOpenItemMenu(openItemMenu === item.id ? null : item.id) }}
    style={{ background: '#F1F5F9', border: '1.5px solid #E2E8F0', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 }}>
    {[0,1,2].map(i => <span key={i} style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: '#64748B', display: 'block' }} />)}
  </button>
</div>
    </div>
  );
})}

<FloatingMenu
  isOpen={!!openItemMenu}
  anchorId={openItemMenu ? `dashboard-item-menu-btn-${openItemMenu}` : 'dashboard-item-menu-anchor'}
  minWidth={190}
  onClose={() => setOpenItemMenu(null)}
>
  {(() => {
    const activeItem = cutoffItems.find(item => item.id === openItemMenu)
    if (!activeItem) return null
    const activeIsPaid = isMonthPaid(activeItem.id, viewMonth + 1)
    const activeReceipt = getMonthReceipt(activeItem.id, viewMonth + 1)
    return (
      <>
        {!activeIsPaid && (
          <button
            onClick={() => { setOpenItemMenu(null); setPayConfirmItem(activeItem); }}
            style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 700, color: '#2563EB', background: 'white', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Poppins', sans-serif" }}>
            <Check size={14} color="#2563EB" /> Mark as Paid
          </button>
        )}
        {activeIsPaid && (
          <button
            onClick={() => { setOpenItemMenu(null); setDashReceiptItem(activeItem); }}
            disabled={!activeReceipt}
            style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: activeReceipt ? '#d97706' : 'var(--text-faint)', background: 'white', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: activeReceipt ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8, opacity: activeReceipt ? 1 : 0.5, fontFamily: "'Poppins', sans-serif" }}>
            <ReceiptText size={14} color={activeReceipt ? '#d97706' : '#94a3b8'} /> View Receipt
          </button>
        )}
        <button
          onClick={() => {
            setOpenItemMenu(null);
            if (activeItem.is_loan) router.push(`/loans?action=edit&id=${activeItem.id}`);
            else router.push(`/budget?action=edit&id=${activeItem.id}`);
          }}
          style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#2563EB', background: 'white', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Poppins', sans-serif" }}>
          <Edit2 size={14} color="#2563EB" /> Edit {activeItem.is_loan ? 'Loan' : 'Expense'}
        </button>
        <button
          onClick={async () => {
            setOpenItemMenu(null);
            if (confirm(`Delete "${activeItem.name}"? This cannot be undone.`)) {
              await supabase.from('budget_items').update({ is_active: false }).eq('id', activeItem.id);
              setItems(prev => prev.filter(i => i.id !== activeItem.id));
            }
          }}
          style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#dc2626', background: 'white', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Poppins', sans-serif" }}>
          <Trash2 size={14} color="#dc2626" /> Delete
        </button>
      </>
    )
  })()}
</FloatingMenu>

{/* Savings check row */}
<div style={{
  padding: "12px 16px", borderTop: "1px solid var(--border)",
  display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "white", flexWrap: "wrap", gap: 8,
}}>
  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
    💰 Include savings goal?
  </p>
  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
    <span style={{ fontSize: 13, color: savingsChecked ? "#16a34a" : "var(--text-muted)", fontWeight: 600 }}>
      {savingsChecked ? `− ${formatCurrency(savingsGoal)}` : formatCurrency(savingsGoal)}
    </span>
    <div onClick={toggleSavings} style={{
      width: 40, height: 22, borderRadius: 999, cursor: "pointer",
      background: savingsChecked ? "#16a34a" : "#e2e8f0",
      position: "relative", transition: "background 0.2s", flexShrink: 0,
      border: "1.5px solid " + (savingsChecked ? "#15803d" : "#cbd5e1"),
    }}>
      <div style={{
        position: "absolute", top: 2, left: savingsChecked ? 18 : 2,
        width: 14, height: 14, borderRadius: "50%", background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
      }} />
    </div>
  </label>
</div>

{/* Income / Expenses / Remaining — redesigned */}
{(() => {
  const expensesPaid    = cutoffItems.filter(i => isMonthPaid(i.id, viewMonth + 1)).reduce((s, i) => s + i.amount, 0);
  const expensesNotPaid = unpaidExpenses;
  const paidPct         = totalExpenses > 0 ? Math.round((expensesPaid / totalExpenses) * 100) : 0;
  const remaining       = afterSavings;
  const isNegative      = remaining < 0;

  return (
    <div style={{ background: "#f8fafc", borderTop: "1.5px solid #e2e8f0", padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Row 1 — Income */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Income</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#2563EB", fontFamily: "monospace" }}>
          {paymentsHidden ? "₱ ••••••" : formatCurrency(totalIncome)}
        </span>
      </div>

      {/* Row 2 — Expenses with progress bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Expenses</span>
              <span style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>only unpaid deducted</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", fontFamily: "monospace" }}>
              {paymentsHidden ? "₱ ••••••" : formatCurrency(totalExpenses)}
            </span>
            {expensesNotPaid < totalExpenses && (
              <span style={{ fontSize: 11, color: "#f97316", fontFamily: "monospace", fontWeight: 600 }}>
                − {paymentsHidden ? "••••" : formatCurrency(expensesNotPaid)} unpaid
              </span>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 999, background: "#fee2e2", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${paidPct}%`, background: "#16a34a", borderRadius: 999, transition: "width 0.4s" }} />
        </div>
        {/* Paid / Unpaid pills */}
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 999, padding: "2px 8px" }}>
            ✓ {paymentsHidden ? "••••" : formatCurrency(expensesPaid)} paid
          </span>
          {expensesNotPaid > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#f97316", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 999, padding: "2px 8px" }}>
              ⏳ {paymentsHidden ? "••••" : formatCurrency(expensesNotPaid)} pending
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-faint)", marginLeft: "auto" }}>{paidPct}% done</span>
        </div>
      </div>

      {/* Row 3 — Savings (only if toggled) */}
      {savingsChecked && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Savings Goal</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b", fontFamily: "monospace" }}>
            {paymentsHidden ? "₱ ••••••" : `− ${formatCurrency(savingsGoal)}`}
          </span>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: "#e2e8f0" }} />

      {/* Row 4 — Remaining */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Remaining Balance After Unpaid Amounts</span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 800, fontFamily: "monospace", color: isNegative ? "#dc2626" : "#16a34a" }}>
            {paymentsHidden ? "₱ ••••••" : (isNegative ? `−${formatCurrency(Math.abs(remaining))}` : formatCurrency(remaining))}
          </span>
          {isNegative && (
            <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>Over budget</span>
          )}
        </div>
      </div>

    </div>
  );
})()}
</div>

      {/* ═══ PAY CONFIRM MODAL ═════════════════════════════════════════════ */}
      {payConfirmItem && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.45)", backdropFilter: "blur(8px)", padding: 16 }}>
          <div className="slide-up" style={{ width: "100%", maxWidth: 360, borderRadius: 20, overflow: "hidden", background: "white", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.18)" }}>

            {/* Header */}
            <div style={{ padding: "22px 20px 14px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#dcfce7", border: "2px solid #0f172a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Check size={22} color="var(--brand-dark)" strokeWidth={3} />
              </div>
              <h2 style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>
                {payAlreadyPaid === null ? "Payment Status" : "Mark as Paid"}
              </h2>
              <p style={{ fontSize: 14, marginTop: 6, fontWeight: 600, color: "var(--text-secondary)" }}>
                {payConfirmItem.name} — {formatCurrency(payConfirmItem.amount)}
              </p>
            </div>

            {/* STEP 1 — Already paid or for payment? */}
            {payAlreadyPaid === null && (
              <div style={{ padding: "0 20px 20px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textAlign: "center", marginBottom: 14 }}>
                  Is this already paid or are you paying now?
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    onClick={() => setPayAlreadyPaid(true)}
                    style={{ width: "100%", padding: "13px 16px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1.5px solid #16a34a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Check size={15} /> Already Paid — just mark it
                  </button>
                  <button
                    onClick={() => setPayAlreadyPaid(false)}
                    style={{ width: "100%", padding: "13px 16px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: "#2563EB", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <CreditCard size={15} /> Pay Now — deduct from account
                  </button>
                  <button
                    onClick={() => { setPayConfirmItem(null); setPaySelectedBank(""); setPayAlreadyPaid(null); setPayTransferFee(""); setReceiptFile(null); setReceiptPreview(null); }}
                    style={{ width: "100%", padding: "10px 0", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "transparent", color: "var(--text-muted)", border: "1.5px solid #e2e8f0", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2a — Already Paid: upload receipt */}
            {payAlreadyPaid === true && (
              <div style={{ padding: "0 20px 20px" }}>
                {/* Receipt upload */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>
                    Upload Receipt <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: receiptPreview ? 6 : "14px 12px", borderRadius: 12, border: `2px dashed ${receiptPreview ? '#16a34a' : '#93c5fd'}`, background: receiptPreview ? '#f0fdf4' : '#f8faff', cursor: "pointer", minHeight: receiptPreview ? 'auto' : 72 }}>
                    {receiptPreview ? (
                      <img src={receiptPreview} alt="Receipt" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
                    ) : (
                      <>
                        <Upload size={20} color="#93c5fd" />
                        <span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>Tap to upload receipt photo</span>
                      </>
                    )}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) { setReceiptFile(f); const url = URL.createObjectURL(f); setReceiptPreview(url) }
                    }} />
                  </label>
                  {receiptPreview && (
                    <button onClick={() => { setReceiptFile(null); setReceiptPreview(null) }}
                      style={{ marginTop: 6, fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      ✕ Remove photo
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setPayAlreadyPaid(null)}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "var(--brand-pale)", color: "var(--brand-dark)", border: "1.5px solid #0f172a", cursor: "pointer" }}>
                    ← Back
                  </button>
                  <button
                    onClick={() => {
                      const month1 = viewMonth + 1;
                      void togglePayment(payConfirmItem, '', undefined, receiptFile);
                      setPayAlreadyPaid(null);
                    }}
                    style={{ flex: 2, padding: "11px 0", borderRadius: 999, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white", border: "none", cursor: "pointer" }}>
                    ✓ Mark as Paid
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2b — Pay Now: pick bank + transfer fee + receipt + confirm deduction */}
            {payAlreadyPaid === false && (
              <>
                <div style={{ margin: "0 20px 12px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>
                    Deduct from which account?
                  </label>
                  <select
                    value={paySelectedBank}
                    onChange={(e) => setPaySelectedBank(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 12, fontSize: 14, border: `1.5px solid ${paySelectedBank && banks.find(b => b.id === paySelectedBank) && banks.find(b => b.id === paySelectedBank)!.balance < payConfirmItem.amount ? '#dc2626' : '#0f172a'}`, background: "var(--bg-subtle)", color: "var(--text-primary)", outline: "none" }}>
                    <option value="">Select bank account...</option>
                    {banks.map(bank => (
                      <option key={bank.id} value={bank.id} disabled={bank.balance < payConfirmItem.amount}>
                        {bank.name} — {formatCurrency(bank.balance)}{bank.balance < payConfirmItem.amount ? ' ⚠️ Low balance' : ''}
                      </option>
                    ))}
                  </select>
                  {paySelectedBank && (() => {
                    const sel = banks.find(b => b.id === paySelectedBank);
                    if (sel && sel.balance < payConfirmItem.amount) {
                      return (
                        <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fca5a5', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1 }}>⚠️</span>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', margin: 0 }}>
                            Your balance is low. Please choose an account that is not below the required amount.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div style={{ margin: "0 20px 12px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>
                    Transfer Fee <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
                  </label>
                  <input type="number" value={payTransferFee} onChange={e => setPayTransferFee(e.target.value)} placeholder="0.00"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13, border: "1.5px solid #0f172a", background: "var(--bg-subtle)", color: "var(--text-primary)", outline: "none" }} />
                  {payTransferFee && parseFloat(payTransferFee) > 0 && (
                    <p style={{ fontSize: 11, marginTop: 5, color: "#854d0e", fontWeight: 600 }}>
                      💡 Total: {formatCurrency(payConfirmItem.amount + (parseFloat(payTransferFee)||0))}
                    </p>
                  )}
                </div>
                {/* Receipt upload */}
                <div style={{ margin: "0 20px 12px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>
                    Upload Receipt <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, padding: receiptPreview ? 6 : "10px 12px", borderRadius: 10, border: `2px dashed ${receiptPreview ? '#16a34a' : '#93c5fd'}`, background: receiptPreview ? '#f0fdf4' : '#f8faff', cursor: "pointer" }}>
                    {receiptPreview ? (
                      <img src={receiptPreview} alt="Receipt" style={{ height: 48, borderRadius: 6, objectFit: 'contain' }} />
                    ) : (
                      <><Upload size={16} color="#93c5fd" /><span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>Tap to attach receipt</span></>
                    )}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) { setReceiptFile(f); setReceiptPreview(URL.createObjectURL(f)) }
                    }} />
                  </label>
                  {receiptPreview && <button onClick={() => { setReceiptFile(null); setReceiptPreview(null) }} style={{ marginTop: 4, fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>✕ Remove</button>}
                </div>
                <div style={{ margin: "0 20px 14px", padding: "11px", borderRadius: 12, background: "#fef9c3", border: "1px solid #0f172a" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, textAlign: "center", color: "#854d0e" }}>
                    ⚠️ This will deduct {formatCurrency(payConfirmItem.amount + (parseFloat(payTransferFee)||0))} from the selected account
                  </p>
                </div>
                <div style={{ padding: "0 20px 20px", display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setPayAlreadyPaid(null)}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "var(--brand-pale)", color: "var(--brand-dark)", border: "1.5px solid #0f172a", cursor: "pointer" }}>
                    ← Back
                  </button>
                  <button
                    onClick={() => {
                      const bankId = paySelectedBank || payConfirmItem.bank_account_id;
                      if (!bankId) { alert("Please select a bank account"); return; }
                      const sel = banks.find(b => b.id === bankId);
                      if (sel && sel.balance < payConfirmItem.amount) { return; }
                      const fee = parseFloat(payTransferFee) || 0;
                      void togglePayment(payConfirmItem, bankId, payConfirmItem.amount + fee, receiptFile);
                    }}
                    disabled={!paySelectedBank && !payConfirmItem.bank_account_id || !!(() => { const sel = banks.find(b => b.id === (paySelectedBank || payConfirmItem.bank_account_id)); return sel && sel.balance < payConfirmItem.amount; })()}
                    style={{ flex: 2, padding: "11px 0", borderRadius: 999, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, #2563EB, #1d4ed8)", color: "white", border: "none", cursor: "pointer", opacity: (!paySelectedBank && !payConfirmItem.bank_account_id) || (() => { const sel = banks.find(b => b.id === (paySelectedBank || payConfirmItem.bank_account_id)); return !!(sel && sel.balance < payConfirmItem.amount); })() ? 0.4 : 1 }}>
                    Confirm & Deduct
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {showSahod && (
        <div className="fixed inset-0 z-50 grid place-items-center modal-overlay p-4">
          <div className="w-full max-w-md mx-auto slide-up rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.16)", display: "flex", flexDirection: "column", maxHeight: "88vh" }}>
            {/* Fixed header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #93c5fd", background: "#eff6ff", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontWeight: 700, color: "#1e3a5f", margin: 0 }}>💸 May Sahod Na!</h2>
                <p style={{ fontSize: 12, marginTop: 2, color: "#3b82f6", margin: "2px 0 0" }}>Choose where to add your salary</p>
              </div>
              <button onClick={() => setShowSahod(false)} style={{ padding: 6, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={17} />
              </button>
            </div>
            {/* Scrollable content */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1, overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: 16, alignItems: "stretch" }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>Which Cutoff?</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[{ label: "1st Cutoff (15th)", val: "1st" as const, salary: activeSalary?.first_cutoff_salary || 0 },
                    { label: "2nd Cutoff (30th)", val: "2nd" as const, salary: activeSalary?.second_cutoff_salary || 0 }].map(opt => (
                    <button key={opt.val} onClick={() => { setSahodCutoff(opt.val); setSahodAmount(opt.salary.toString()); }}
                      style={{ padding: "10px 8px", borderRadius: 12, textAlign: "center", cursor: "pointer", background: sahodCutoff === opt.val ? "#dbeafe" : "var(--bg-subtle)", border: `1.5px solid ${sahodCutoff === opt.val ? "#93c5fd" : "var(--border)"}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", margin: 0 }}>{opt.label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#2563eb", margin: 0 }}>{formatCurrency(opt.salary)}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>Add to Account</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {banks.map(b => {
                    const selected = sahodBankId ? sahodBankId === b.id : b.is_main_bank;
                    return (
                      <button key={b.id} onClick={() => setSahodBankId(b.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${selected ? "#2563EB" : "var(--border)"}`, background: selected ? "#eff6ff" : "var(--bg-subtle)", cursor: "pointer", transition: "all 0.15s", textAlign: "left" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: selected ? "#1d4ed8" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>{b.name}</p>
                          <p style={{ fontSize: 11, color: "var(--text-faint)", margin: 0 }}>{b.type} {b.is_main_bank ? "· Main" : ""}</p>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>{formatCurrency(b.balance)}</span>
                        {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
                {/* Non-main bank warning */}
                {(() => {
                  const selectedBank = banks.find(b => sahodBankId ? b.id === sahodBankId : b.is_main_bank);
                  if (selectedBank && !selectedBank.is_main_bank) {
                    return (
                      <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "#fff7ed", border: "1.5px solid #fed7aa", display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 15, lineHeight: 1, marginTop: 1 }}>ℹ️</span>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#c2410c", margin: 0 }}>
                          Balance will be added to <strong>{selectedBank.name}</strong>, but your <strong>salary figures won't update</strong> since this isn't your main account.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>Salary Amount (₱)</label>
                <input type="number" value={sahodAmount} onChange={e => setSahodAmount(e.target.value)} placeholder="Enter sahod amount..." className="w-full px-3 py-2.5 text-sm" autoFocus style={{ textAlign: "center" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>
                  Extra Income (₱) <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>— optional</span>
                </label>
                <input type="number" value={sahodExtra} onChange={e => setSahodExtra(e.target.value)} placeholder="Bonus, allowance, etc..." className="w-full px-3 py-2.5 text-sm" style={{ textAlign: "center" }} />
              </div>
              {(parseFloat(sahodAmount) > 0 || parseFloat(sahodExtra) > 0) && (() => {
                const targetBank = banks.find(b => b.id === sahodBankId) || banks.find(b => b.is_main_bank);
                return (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "var(--bg-subtle)", border: "1.5px solid #0f172a", fontSize: 12 }}>
                    <span style={{ color: "var(--text-muted)" }}>Total adding to <strong>{targetBank?.name || "account"}</strong></span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#2563eb" }}>
                      {formatCurrency((parseFloat(sahodAmount) || 0) + (parseFloat(sahodExtra) || 0))}
                    </span>
                  </div>
                );
              })()}
            </div>
            {/* Fixed footer buttons */}
            <div style={{ padding: "12px 20px 20px", display: "flex", gap: 12, flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
              <button onClick={() => setShowSahod(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 999, fontSize: 14, fontWeight: 600, background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1.5px solid #0f172a", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSahod} disabled={!sahodAmount || sahodSaving} style={{ flex: 1, padding: "10px 0", borderRadius: 999, fontSize: 14, fontWeight: 700, color: "white", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", border: "none", cursor: "pointer", opacity: (!sahodAmount || sahodSaving) ? 0.5 : 1 }}>
                {sahodSaving ? "Adding..." : "Add Sahod 💸"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BANK TRANSFER MODAL ══════════════════════════════════════════ */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 grid place-items-center modal-overlay p-4">
          <div className="w-full max-w-md mx-auto slide-up rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.16)", display: "flex", flexDirection: "column", maxHeight: "88vh" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #bbf7d0", background: "#f0fdf4", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontWeight: 700, color: "#14532d", margin: 0 }}>⇄ Transfer Money</h2>
                <p style={{ fontSize: 12, marginTop: 2, color: "#16a34a", margin: "2px 0 0" }}>Move funds between your accounts</p>
              </div>
              <button onClick={() => setShowTransfer(false)} style={{ padding: 6, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={17} />
              </button>
            </div>
            {/* Body */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* From */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>From Account</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {banks.map(b => {
                    const sel = transferFromId === b.id;
                    return (
                      <button key={b.id} onClick={() => setTransferFromId(b.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${sel ? "#dc2626" : "var(--border)"}`, background: sel ? "#fef2f2" : "var(--bg-subtle)", cursor: "pointer", textAlign: "left" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: sel ? "#dc2626" : "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</p>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>{formatCurrency(b.balance)}</span>
                        {sel && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* To */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>To Account</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {banks.filter(b => b.id !== transferFromId).map(b => {
                    const sel = transferToId === b.id;
                    return (
                      <button key={b.id} onClick={() => setTransferToId(b.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${sel ? "#2563EB" : "var(--border)"}`, background: sel ? "#eff6ff" : "var(--bg-subtle)", cursor: "pointer", textAlign: "left" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: sel ? "#1d4ed8" : "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</p>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>{formatCurrency(b.balance)}</span>
                        {sel && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Amount */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>Amount (₱)</label>
                <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 text-sm" style={{ textAlign: "center" }} />
              </div>
              {/* Note */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>Note <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>— optional</span></label>
                <input type="text" value={transferNote} onChange={e => setTransferNote(e.target.value)} placeholder="e.g. for bills, savings..." className="w-full px-3 py-2.5 text-sm" />
              </div>
              {/* Summary */}
              {transferFromId && transferToId && parseFloat(transferAmount) > 0 && (() => {
                const from = banks.find(b => b.id === transferFromId);
                const to   = banks.find(b => b.id === transferToId);
                const amt  = parseFloat(transferAmount);
                const insufficient = from && from.balance < amt;
                return (
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: insufficient ? "#fef2f2" : "var(--bg-subtle)", border: `1.5px solid ${insufficient ? "#fca5a5" : "#0f172a"}`, fontSize: 12 }}>
                    {insufficient ? (
                      <p style={{ color: "#dc2626", fontWeight: 600, margin: 0 }}>⚠️ Insufficient balance in {from?.name} ({formatCurrency(from?.balance || 0)} available)</p>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--text-muted)" }}>{from?.name} <span style={{ color: "#94a3b8" }}>→</span> {to?.name}</span>
                        <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#16a34a" }}>−{formatCurrency(amt)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            {/* Footer */}
            <div style={{ padding: "12px 20px 20px", display: "flex", gap: 12, flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}>
              <button onClick={() => setShowTransfer(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 999, fontSize: 14, fontWeight: 600, background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1.5px solid #0f172a", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleTransfer}
                disabled={transferSaving || !transferFromId || !transferToId || !transferAmount || transferFromId === transferToId || (() => { const f = banks.find(b => b.id === transferFromId); return !!(f && f.balance < parseFloat(transferAmount)); })()}
                style={{ flex: 2, padding: "10px 0", borderRadius: 999, fontSize: 14, fontWeight: 700, color: "white", background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", cursor: "pointer", opacity: (transferSaving || !transferFromId || !transferToId || !transferAmount || transferFromId === transferToId) ? 0.4 : 1 }}>
                {transferSaving ? "Transferring..." : "⇄ Transfer"}
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

      {/* ═══ DASHBOARD RECEIPT MODAL ══════════════════════════════════════ */}
      {dashReceiptItem && (() => {
        const receiptUrl = getMonthReceipt(dashReceiptItem.id, viewMonth + 1);
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
            <div className="w-full max-w-md slide-up rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--bg-surface)', border: '1.5px solid #0f172a', boxShadow: '0 8px 32px rgba(15,23,42,0.2)', maxHeight: '88vh' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1.5px solid #d97706', background: '#fffbeb', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', border: '1.5px solid #d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ReceiptText size={16} color="#d97706" />
                  </div>
                  <div>
                    <h2 style={{ fontWeight: 700, fontSize: 15, color: '#92400e', margin: 0 }}>Receipt</h2>
                    <p style={{ fontSize: 11, color: '#d97706', margin: '2px 0 0' }}>{dashReceiptItem.name} • {MONTHS_LONG[viewMonth]} {viewYear}</p>
                  </div>
                </div>
                <button onClick={() => setDashReceiptItem(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#fef3c7', border: '1.5px solid #d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={15} color="#d97706" />
                </button>
              </div>
              <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!receiptUrl ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-faint)' }}>
                    <ReceiptText size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                    <p style={{ fontSize: 14, fontWeight: 600 }}>No receipt uploaded</p>
                  </div>
                ) : (
                  <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid #d97706', background: 'white', boxShadow: '0 0 0 3px rgba(217,119,6,0.1)' }}>
                    <div style={{ padding: '10px 14px', background: '#fffbeb', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{dashReceiptItem.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{formatCurrency(dashReceiptItem.amount)}</p>
                      </div>
                      <a href={receiptUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#2563eb', textDecoration: 'none', padding: '5px 10px', borderRadius: 999, background: '#eff6ff', border: '1px solid #93c5fd' }}>Open ↗</a>
                    </div>
                    <a href={receiptUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                      <img src={receiptUrl} alt={`${dashReceiptItem.name} receipt`} style={{ width: '100%', maxHeight: 400, objectFit: 'contain', background: '#f8fafc', display: 'block' }} />
                    </a>
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <button onClick={() => setDashReceiptItem(null)} style={{ width: '100%', padding: '11px 0', borderRadius: 999, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white', border: 'none', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}
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
    <div className="fixed inset-0 z-50 grid place-items-center modal-overlay p-4">
      <div className="w-full max-w-md mx-auto slide-up rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.16)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
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


// Month Picker Dropdown Component - styled like 3-dot menu
function MonthPickerDropdown({ top, right, viewMonth, onSelect, onClose }: { 
  top: number; 
  right: number; 
  viewMonth: number; 
  onSelect: (month: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeMenu = () => onClose()
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [onClose])

  return (
    <div
      style={{
        position: "fixed",
        top: top,
        right: right,
        zIndex: 9999,
      }}
    >
      <div style={{
        background: 'white',
        border: '1.5px solid #0f172a',
        borderRadius: 12,
        boxShadow: '0 8px 28px rgba(15,23,42,0.22)',
        padding: 8,
        minWidth: 200,
      }}>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS_LONG.map((m, i) => (
            <button
              key={m}
              onClick={() => onSelect(i)}
              style={{
                padding: '10px 8px',
                fontSize: 13,
                fontFamily: 'Poppins, sans-serif',
                borderRadius: 8,
                border: i === viewMonth ? '1.5px solid #2563EB' : '1.5px solid transparent',
                background: i === viewMonth ? '#eff6ff' : 'white',
                color: i === viewMonth ? '#2563EB' : '#0f172a',
                fontWeight: i === viewMonth ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="w-full flex items-center justify-center h-64"><div className="spinner" /></div>}>
      <DashboardPageInner />
    </Suspense>
  );
}