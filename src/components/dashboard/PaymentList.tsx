"use client";
import { useState, useEffect } from "react";
import { Check, Eye, EyeOff, CreditCard, ReceiptText, ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { BudgetItem, EXPENSE_CATEGORIES, Cutoff } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import FloatingMenu from "@/components/FloatingMenu";
import { useRouter } from "next/navigation";

export interface CreditRecord {
  id: string; user_id: string; name: string; amount: number;
  source: string; source_account_id: string | null;
  due_date: string | null; date_taken: string;
  used_status: "Unpaid" | "Paid"; due_status: "Unpaid" | "Paid";
  receipt_before: string | null; used_receipt_url: string | null;
  due_receipt_url: string | null; used_payment_bank_id: string | null;
  due_payment_bank_id: string | null; used_transfer_fee: number;
  due_transfer_fee: number; notes: string | null;
}

interface PaymentState { [id: string]: { [month: number]: { paid: boolean; receipt_url?: string } } }

interface Props {
  cutoffItems: BudgetItem[];
  creditRows: { credit: CreditRecord; rowType: "used" | "due" }[];
  payments: PaymentState;
  banks: { id: string; name: string; balance: number }[];
  viewMonth: number; viewYear: number; activeTab: Cutoff;
  savingsChecked: boolean; savingsGoal: number; totalIncome: number;
  onToggleSavings: () => void;
  onPayItem: (item: BudgetItem) => void;
  onViewReceipt: (item: BudgetItem) => void;
  onMarkCreditPaid: (id: string, rowType: "used" | "due") => void;
  onViewCredit: (id: string, rowType: "used" | "due") => void;
  onViewCreditReceipt?: (url: string) => void;
}

function catEmoji(category: string, isLoan: boolean, isUnlimited: boolean): string {
  if (isUnlimited) return "🔧";
  if (isLoan)      return "💳";
  const map: Record<string, string> = {
    "Food & Dining": "🍽️", Shopping: "🛍️", Vehicle: "🚗",
    Healthcare: "💊", Education: "📚", Entertainment: "🎮",
    Utilities: "💡", Transportation: "🚌", Others: "📦",
  };
  return map[category] ?? "💰";
}

function ThreeDotBtn({ id, onClick }: { id: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button id={id} onClick={onClick} className="menu-btn">
      <MoreHorizontal size={15} />
    </button>
  );
}

export default function PaymentList({
  cutoffItems, creditRows, payments, banks,
  viewMonth, viewYear, activeTab,
  savingsChecked, savingsGoal, totalIncome,
  onToggleSavings, onPayItem, onViewReceipt, onMarkCreditPaid, onViewCredit,
}: Props) {
  const router = useRouter();
  const [hidden,     setHidden]     = useState(false);
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({});
  const [itemMenu,   setItemMenu]   = useState<string | null>(null);
  const [creditMenu, setCreditMenu] = useState<string | null>(null);
  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try { if (localStorage.getItem("paymentsHidden") === "true") setHidden(true); } catch {}
  }, []);

  useEffect(() => {
    if (!itemMenu) return;
    const h = () => setItemMenu(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [itemMenu]);

  const isPaid     = (id: string) => payments[id]?.[viewMonth + 1]?.paid ?? false;
  const getReceipt = (id: string) => payments[id]?.[viewMonth + 1]?.receipt_url || "";

  const sorted = [...cutoffItems].sort((a, b) => {
    const ap = isPaid(a.id) ? 1 : 0, bp = isPaid(b.id) ? 1 : 0;
    return ap - bp;
  });

  const totalExpenses = cutoffItems.reduce((s, i) => s + i.amount, 0);
  const unpaidAmt     = cutoffItems.filter(i => !isPaid(i.id)).reduce((s, i) => s + i.amount, 0);
  const paidAmt       = totalExpenses - unpaidAmt;
  const paidCount     = cutoffItems.filter(i => isPaid(i.id)).length;
  const totalCount    = cutoffItems.length + creditRows.length;
  const remaining     = totalIncome - unpaidAmt - (savingsChecked ? savingsGoal : 0);
  const isNeg         = remaining < 0;

  const PAGE_SIZE  = 5;
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageItems  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // ── Item Row ──────────────────────────────────────────────
  function ItemRow({ item }: { item: BudgetItem }) {
  const paid_      = isPaid(item.id);
  const isLoan     = item.is_loan;
  const isUnlim    = isLoan && ((item.loan_details as any)?.total_months >= 9999);
  const isExpanded = expanded[item.id];
  const catInfo    = EXPENSE_CATEGORIES.find(c => c.value === item.category);
  const catLabel   = catInfo?.label?.split(" ").slice(1).join(" ") || item.category || "General";
  const dateAdded  = item.created_at
    ? new Date(item.created_at).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const cutoffMap = {
  both: "Both Cutoffs",
  "1st": "1st Cutoff",
  "2nd": "2nd Cutoff",
};

const cutoffLabel = cutoffMap[item.cutoff] || "";
  const emoji      = catEmoji(item.category ?? "", isLoan, isUnlim);
  const nameColor  = isUnlim ? "#16A34A" : isLoan ? "#4F46E5" : "#FF8B00";
  const borderColor = isUnlim ? "#16A34A" : isLoan ? "#4F46E5" : "#FF8B00";

  const mainRow = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderBottom: isExpanded ? "1px solid #F1F5F9" : "none",
        background: "white",
        cursor: "pointer",
        borderLeft: `3px solid ${borderColor}`,
        transition: "background 0.12s",
      }}
      onClick={() => toggleExpand(item.id)}
    >
      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          flexShrink: 0,
          background: isLoan ? "#FEF3C7" : "#FFF7ED",
          border: `1.5px solid ${isLoan ? "#FDE68A" : "#FFEDD5"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
        }}
      >
        {emoji}
      </div>

      {/* Name + category */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontWeight: 800,
            fontSize: 14,
            color: nameColor,
            margin: 0,
            fontFamily: "Nunito, sans-serif",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.name}
        </p>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            margin: "2px 0 0",
          }}
        >
          {isUnlim ? "Maintenance" : isLoan ? "Loan" : catLabel}
        </p>
      </div>

      {/* Amount */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {paid_ ? (
          <>
            <p
              style={{
                fontWeight: 800,
                fontSize: 13,
                fontFamily: "Nunito, sans-serif",
                color: "var(--text-muted)",
                textDecoration: "line-through",
                margin: 0,
                whiteSpace: "nowrap",
              }}
            >
              {hidden ? "₱ ••••" : formatCurrency(item.amount)}
            </p>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#16A34A",
                margin: "1px 0 0",
              }}
            >
              ✓ Paid
            </p>
          </>
        ) : (
          <span
            style={{
              fontWeight: 800,
              fontSize: 14,
              fontFamily: "Nunito, sans-serif",
              color: "#EF4444",
              whiteSpace: "nowrap",
            }}
          >
            {hidden ? "₱ ••••" : formatCurrency(item.amount)}
          </span>
        )}
      </div>

      <ThreeDotBtn
        id={`item-m-${item.id}`}
        onClick={(e) => {
          e.stopPropagation();
          setItemMenu(itemMenu === item.id ? null : item.id);
        }}
      />

      <button
        className="chevron-btn"
        onClick={(e) => {
          e.stopPropagation();
          toggleExpand(item.id);
        }}
      >
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    </div>
  );

  const expandedSection = isExpanded ? (
    <div
      style={{
        background: "#FAFBFF",
        padding: "10px 14px 14px",
        borderTop: "1px solid #F1F5F9",
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "4px 0",
          borderBottom: "1px solid #F1F5F9",
          fontSize: 12,
        }}
      >
        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
          Date Added:
        </span>
        <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>
          {dateAdded}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "4px 0",
          borderBottom: "1px solid #F1F5F9",
          fontSize: 12,
        }}
      >
        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>
          Cutoff Reflected:
        </span>
        <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>
          {cutoffLabel}
        </span>
      </div>

      <div style={{ marginTop: 8 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            margin: "0 0 4px",
          }}
        >
          Note:
        </p>

        <div
          style={{
            background: "#F8FAFF",
            border: "1px solid #E8ECF8",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            color: "var(--text-muted)",
            fontWeight: 500,
          }}
        >
          {(item as any).notes || "No Notes Added."}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div
      key={item.id}
      style={{
        margin: "6px 12px",
        border: "1px solid #E6EAF0",
        borderRadius: 14,
        background: "white",
        overflow: "hidden",
      }}
    >
      {mainRow}
      {expandedSection}
    </div>
  );
}

  return (
    <>
      {/* ── Payment List Card ── */}
      <div style={{
        background: "white", borderRadius: 20,
        border: "1.5px solid var(--border)",
        boxShadow: "0 2px 12px rgba(15,23,42,0.07)",
        overflow: "hidden", marginBottom: 14,
      }}>

        {/* Legend row — matches design: ● Expenses ● Loan ● Maintenance + eye toggle */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid #F1F5F9",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {[
              { color: "#FF8B00", label: "Expenses" },
              { color: "#4F46E5", label: "Loan" },
              { color: "#16A34A", label: "Maintenance" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "block", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "Nunito, sans-serif" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const next = !hidden;
              setHidden(next);
              try { localStorage.setItem("paymentsHidden", String(next)); } catch {}
            }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", display: "flex", alignItems: "center" }}
          >
            {hidden ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        </div>

        {/* Item rows */}
        {pageItems.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-faint)", fontSize: 14 }}>
            No items yet for this cutoff.
          </div>
        ) : (
          <div style={{ padding: "4px 0" }}>
            
            {pageItems.map(item => <ItemRow key={item.id} item={item} />)}
          </div>
        )}

        {/* Item floating menu */}
        <FloatingMenu
          isOpen={!!itemMenu}
          anchorId={itemMenu ? `item-m-${itemMenu}` : "item-m-anchor"}
          minWidth={192}
          onClose={() => setItemMenu(null)}
        >
          {(() => {
            const it = cutoffItems.find(i => i.id === itemMenu);
            if (!it) return null;
            const ip  = isPaid(it.id);
            const rec = getReceipt(it.id);
            const isLoanItem = it.is_loan;
            const goToLabel = isLoanItem ? "Go to Loan Page" : "Go to Expenses Page";
            const goToPath  = isLoanItem ? "/loans" : "/budget";
            const menuItemStyle = (color: string, borderBottom = true): React.CSSProperties => ({
              width: "100%", padding: "13px 18px", fontSize: 14, fontWeight: 600,
              color, background: "white", border: "none",
              borderBottom: borderBottom ? "1px solid #F1F5F9" : "none",
              cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center",
              justifyContent: "space-between", fontFamily: "Nunito, sans-serif",
            });
            return (
              <>
                {ip ? (
                  <button onClick={() => { setItemMenu(null); if (rec) onViewReceipt(it); }} disabled={!rec}
                    style={{ ...menuItemStyle(rec ? "#1a1a2e" : "var(--text-faint)"), opacity: rec ? 1 : 0.45 }}>
                    <span style={{ display:"flex", alignItems:"center", gap:10 }}><ReceiptText size={15} color={rec?"#1a1a2e":"#94a3b8"}/> View Receipt</span>
                    <ChevronDown size={13} style={{ transform:"rotate(-90deg)", color:"#94a3b8" }}/>
                  </button>
                ) : (
                  <button onClick={() => { setItemMenu(null); onPayItem(it); }}
                    style={menuItemStyle("#16A34A")}>
                    <span style={{ display:"flex", alignItems:"center", gap:10 }}><Check size={15} color="#16A34A"/> Mark as Paid</span>
                    <ChevronDown size={13} style={{ transform:"rotate(-90deg)", color:"#94a3b8" }}/>
                  </button>
                )}
                <button onClick={() => { setItemMenu(null); router.push(goToPath); }}
                  style={menuItemStyle("#1a1a2e", false)}>
                  <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                    {isLoanItem
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                    }
                    {goToLabel}
                  </span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                </button>
              </>
            );
          })()}
        </FloatingMenu>

        {/* Credit rows */}
        {creditRows.map(({ credit, rowType }) => {
          const isUsed  = rowType === "used";
          const rowStat = isUsed ? credit.used_status : credit.due_status;
          const ip      = rowStat === "Paid";
          const mk      = `${credit.id}-${rowType}`;
          const isExpCr = expandedCredits[mk] ?? false;
          const dateStr = isUsed
            ? (credit.date_taken ? new Date(credit.date_taken + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—")
            : (credit.due_date   ? new Date(credit.due_date   + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—");
          const borderColor = ip ? "#16A34A" : isUsed ? "#7C3AED" : "#EA580C";
          return (
            <div key={mk} style={{ margin: "6px 12px", border: "1px solid #E6EAF0", borderRadius: 14, background: "white", overflow: "hidden" }}>
              {/* Main row */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "white", borderLeft: `3px solid ${borderColor}`, cursor: "pointer", borderBottom: isExpCr ? "1px solid #F1F5F9" : "none" }}
                onClick={() => setExpandedCredits(prev => ({ ...prev, [mk]: !prev[mk] }))}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#FEF3C7", border: "1.5px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 16 }}>💳</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: ip ? "#16A34A" : isUsed ? "#7C3AED" : "#EA580C", margin: 0, fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {credit.name}
                    </p>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: isUsed ? "#F5F3FF" : "#FFF7ED", color: isUsed ? "#7C3AED" : "#EA580C", border: isUsed ? "1px solid #DDD6FE" : "1px solid #FED7AA", flexShrink: 0 }}>
                      {isUsed ? "USED" : "DUE"}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {isUsed ? `Used: ${dateStr}` : `Due: ${dateStr}`}
                  </p>
                </div>
                {/* Amount */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {ip ? (
                    <>
                      <p style={{ fontWeight: 800, fontSize: 13, fontFamily: "Nunito, sans-serif", color: "var(--text-muted)", textDecoration: "line-through", margin: 0, whiteSpace: "nowrap" }}>
                        {hidden ? "₱ ••••" : formatCurrency(credit.amount)}
                      </p>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", margin: "1px 0 0" }}>✓ Paid</p>
                    </>
                  ) : (
                    <span style={{ fontWeight: 800, fontSize: 14, fontFamily: "Nunito, sans-serif", color: "#EF4444", whiteSpace: "nowrap" }}>
                      {hidden ? "₱ ••••" : formatCurrency(credit.amount)}
                    </span>
                  )}
                </div>
                <ThreeDotBtn
                  id={`cred-m-${mk}`}
                  onClick={e => { e.stopPropagation(); setCreditMenu(creditMenu === mk ? null : mk); }}
                />
                <button
                  className="chevron-btn"
                  onClick={e => { e.stopPropagation(); setExpandedCredits(prev => ({ ...prev, [mk]: !prev[mk] })); }}
                >
                  {isExpCr ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
              {/* Expanded section */}
              {isExpCr && (
                <div style={{ background: "#FAFBFF", padding: "10px 14px 14px", borderLeft: `3px solid ${borderColor}` }}>
                  {[
                    { label: isUsed ? "Date Used:" : "Due Date:", value: dateStr },
                    { label: "Source:", value: credit.source || "—" },
                    ...(isUsed && credit.used_transfer_fee > 0 ? [{ label: "Transfer Fee:", value: formatCurrency(credit.used_transfer_fee) }] : []),
                    ...(!isUsed && credit.due_transfer_fee > 0 ? [{ label: "Transfer Fee:", value: formatCurrency(credit.due_transfer_fee) }] : []),
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #F1F5F9", fontSize: 12 }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{row.label}</span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 4px" }}>Note:</p>
                    <div style={{ background: "#F8FAFF", border: "1px solid #E8ECF8", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                      {credit.notes || "No Notes Added."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Credit menu */}
        <FloatingMenu
          isOpen={!!creditMenu}
          anchorId={creditMenu ? `cred-m-${creditMenu}` : "cred-m-anchor"}
          minWidth={192}
          onClose={() => setCreditMenu(null)}
        >
          {(() => {
            if (!creditMenu) return null;
            const parts = creditMenu.split("-");
            const rt  = parts[parts.length - 1] as "used" | "due";
            const cid = parts.slice(0, -1).join("-");
            const cred = creditRows.find(r => r.credit.id === cid && r.rowType === rt)?.credit;
            if (!cred) return null;
            const ip = (rt === "used" ? cred.used_status : cred.due_status) === "Paid";
            const menuItemStyle = (color: string, borderBottom = true): React.CSSProperties => ({
              width: "100%", padding: "13px 18px", fontSize: 14, fontWeight: 600,
              color, background: "white", border: "none",
              borderBottom: borderBottom ? "1px solid #F1F5F9" : "none",
              cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center",
              justifyContent: "space-between", fontFamily: "Nunito, sans-serif",
            });
            return (
              <>
                {!ip && (
                  <button onClick={() => { setCreditMenu(null); onMarkCreditPaid(cred.id, rt); }}
                    style={menuItemStyle("#16A34A")}>
                    <span style={{ display:"flex", alignItems:"center", gap:10 }}><Check size={15} color="#16A34A"/> Mark as Paid</span>
                    <ChevronDown size={13} style={{ transform:"rotate(-90deg)", color:"#94a3b8" }}/>
                  </button>
                )}
                <button onClick={() => { setCreditMenu(null); router.push("/credits"); }}
                  style={menuItemStyle("#1a1a2e", false)}>
                  <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <CreditCard size={15}/> Go to Credits Page
                  </span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                </button>
              </>
            );
          })()}
        </FloatingMenu>

        {/* Pagination */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", borderTop: "1px solid #F1F5F9",
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", margin: 0 }}>
            {paidCount}/{totalCount} Paid Items
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="page-nav-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronDown size={14} style={{ transform: "rotate(90deg)" }} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
              Page {page}/{Math.max(totalPages, 1)}
            </span>
            <button className="page-nav-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
            </button>
          </div>
        </div>

      </div>

      {/* ── Savings toggle — separate white card ── */}
      <div style={{
        background: "white", borderRadius: 16,
        boxShadow: "0 2px 12px rgba(15,23,42,0.06)",
        padding: "14px 16px", marginBottom: 14,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          Do you have Saving for the cutoff Today?<br />
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Deduct {formatCurrency(savingsGoal)} from Remaining?</span>
        </p>
        <div
          onClick={onToggleSavings}
          style={{
            position: "relative", width: 48, height: 26, borderRadius: 13,
            background: savingsChecked ? "#16A34A" : "#E2E8F0",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <span style={{
            position: "absolute", top: 3,
            left: savingsChecked ? 24 : 3,
            width: 20, height: 20, borderRadius: "50%",
            background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
            transition: "left 0.2s", display: "block",
          }} />
        </div>
      </div>

      {/* ── Financial Summary — warm peach card ── */}
      <div style={{
        background: "#FEF5EE", borderRadius: 20,
        overflow: "hidden", marginBottom: 14,
      }}>
        {/* today's Cutoff Income */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", borderBottom: "1px solid #F5E8DF",
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "Nunito, sans-serif" }}>
            today's Cutoff Income
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Nunito, sans-serif" }}>
            {hidden ? "₱ ••••••" : formatCurrency(totalIncome)}
          </span>
        </div>

        {/* Expenses this Cutoff */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", borderBottom: "1px solid #F5E8DF",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Nunito, sans-serif" }}>
            Expenses this Cutoff
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Nunito, sans-serif" }}>
            {hidden ? "₱ ••••••" : formatCurrency(totalExpenses)}
          </span>
        </div>

        {/* Expenses Not Paid */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", borderBottom: "1px solid #F5E8DF",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: "#7C3AED", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Expenses Not Paid</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "Nunito, sans-serif" }}>
            {hidden ? "₱ ••••" : formatCurrency(unpaidAmt)}
          </span>
        </div>

        {/* Expenses Paid */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", borderBottom: "1px solid #F5E8DF",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: "#16A34A", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Expenses Paid</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "Nunito, sans-serif" }}>
            {hidden ? "₱ ••••" : formatCurrency(paidAmt)}
          </span>
        </div>

        {/* Income - Not Paid — always red, large */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 16px",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Nunito, sans-serif" }}>
            Income - Not Paid
          </span>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#EF4444", fontFamily: "Nunito, sans-serif" }}>
            {hidden ? "₱ ••••••" : formatCurrency(remaining)}
          </span>
        </div>
      </div>
    </>
  );
}