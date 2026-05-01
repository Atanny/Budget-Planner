"use client";
import { useState } from "react";
import { Check, CreditCard, Upload } from "lucide-react";
import { BudgetItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface PayConfirmModalProps {
  item: BudgetItem;
  banks: { id: string; name: string; balance: number }[];
  onClose: () => void;
  onConfirm: (params: { bankId: string; totalAmount: number; receiptFile: File | null }) => Promise<void>;
}

export default function PayConfirmModal({ item, banks, onClose, onConfirm }: PayConfirmModalProps) {
  const [step,           setStep]           = useState<null | "already" | "payNow">(null);
  const [selectedBank,   setSelectedBank]   = useState("");
  const [transferFee,    setTransferFee]    = useState("");
  const [receiptFile,    setReceiptFile]    = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  const selectedBankObj = banks.find(b => b.id === selectedBank);
  const fee             = parseFloat(transferFee) || 0;
  const totalAmount     = item.amount + fee;
  const lowBalance      = !!(selectedBankObj && selectedBankObj.balance < totalAmount);

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) { setReceiptFile(f); setReceiptPreview(URL.createObjectURL(f)); }
  }

  async function handleConfirm(params: { bankId: string; totalAmount: number; receiptFile: File | null }) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(params);
    } catch (err) {
      console.error(err);
      setError("Payment failed. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.45)", backdropFilter: "blur(8px)", padding: 16 }}>
      <div className="slide-up" style={{ width: "100%", maxWidth: 360, borderRadius: 20, overflow: "hidden", background: "white", border: "1px solid #E2E8F0", boxShadow: "0 8px 32px rgba(15,23,42,0.18)" }}>

        {/* Header */}
        <div style={{ padding: "22px 20px 14px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "#dcfce7", border: "2px solid #86EFAC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <Check size={22} color="var(--brand-dark)" strokeWidth={3} />
          </div>
          <h2 style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>
            {step === null ? "Payment Status" : "Mark as Paid"}
          </h2>
          <p style={{ fontSize: 14, marginTop: 6, fontWeight: 600, color: "var(--text-secondary)" }}>
            {item.name} — {formatCurrency(item.amount)}
          </p>
        </div>

        {/* Step 0: choose mode */}
        {step === null && (
          <div style={{ padding: "0 20px 20px" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textAlign: "center", marginBottom: 14 }}>
              Is this already paid or are you paying now?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => setStep("already")}
                style={{ width: "100%", padding: "13px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, background: "#f0fdf4", color: "#16a34a", border: "1.5px solid #16a34a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Check size={15} /> Already Paid — just mark it
              </button>
              <button onClick={() => setStep("payNow")}
                style={{ width: "100%", padding: "13px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, background: "#2563EB", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <CreditCard size={15} /> Pay Now — deduct from account
              </button>
              <button onClick={onClose}
                className="btn-cancel" style={{ width: "100%" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step: already paid */}
        {step === "already" && (
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>
                Upload Receipt <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
              </label>
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: receiptPreview ? 6 : "14px 12px", borderRadius: 12, border: `2px dashed ${receiptPreview ? "#16a34a" : "#93c5fd"}`, background: receiptPreview ? "#f0fdf4" : "#f8faff", cursor: "pointer", minHeight: receiptPreview ? "auto" : 72 }}>
                {receiptPreview ? <img src={receiptPreview} alt="Receipt" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} /> : (
                  <><Upload size={20} color="#93c5fd" /><span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>Tap to upload receipt photo</span></>
                )}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleReceiptChange} />
              </label>
              {receiptPreview && <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); }} style={{ marginTop: 6, fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>✕ Remove photo</button>}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(null)} disabled={saving} className="btn-cancel" style={{ flex: 1 }}>← Back</button>
              <button onClick={() => handleConfirm({ bankId: "", totalAmount: item.amount, receiptFile })}
                disabled={saving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, background: saving ? "#86efac" : "linear-gradient(135deg, #16a34a, #15803d)", color: "white", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving..." : "✓ Mark as Paid"}
              </button>
            </div>
          </div>
        )}

        {/* Step: pay now */}
        {step === "payNow" && (
          <>
            {/* Bank selector */}
            <div style={{ margin: "0 20px 12px" }}>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block", color: "var(--text-secondary)" }}>Deduct from which account?</label>
              <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, fontSize: 14, border: `1.5px solid ${lowBalance ? "#dc2626" : "#E2E8F0"}`, background: "var(--bg-subtle)", color: "var(--text-primary)", outline: "none" }}>
                <option value="">Select bank account...</option>
                {banks.map(b => <option key={b.id} value={b.id} disabled={b.balance < item.amount}>{b.name} — {formatCurrency(b.balance)}{b.balance < item.amount ? " ⚠️ Low balance" : ""}</option>)}
              </select>
              {lowBalance && (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1.5px solid #fca5a5", display: "flex", gap: 8 }}>
                  <span>⚠️</span>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", margin: 0 }}>Your balance is low. Please choose an account that is not below the required amount.</p>
                </div>
              )}
            </div>

            {/* Transfer fee */}
            <div style={{ margin: "0 20px 12px" }}>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>Transfer Fee <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span></label>
              <input type="number" value={transferFee} onChange={e => setTransferFee(e.target.value)} placeholder="0.00"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13, border: "1.5px solid #E2E8F0", background: "var(--bg-subtle)", color: "var(--text-primary)", outline: "none" }} />
              {fee > 0 && <p style={{ fontSize: 11, marginTop: 5, color: "#854d0e", fontWeight: 600 }}>💡 Total: {formatCurrency(totalAmount)}</p>}
            </div>

            {/* Receipt */}
            <div style={{ margin: "0 20px 12px" }}>
              <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block", color: "var(--text-secondary)" }}>Upload Receipt <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span></label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: receiptPreview ? 6 : "10px 12px", borderRadius: 10, border: `2px dashed ${receiptPreview ? "#16a34a" : "#93c5fd"}`, background: receiptPreview ? "#f0fdf4" : "#f8faff", cursor: "pointer" }}>
                {receiptPreview ? <img src={receiptPreview} alt="Receipt" style={{ height: 48, borderRadius: 6, objectFit: "contain" }} /> : <><Upload size={16} color="#93c5fd" /><span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>Tap to attach receipt</span></>}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleReceiptChange} />
              </label>
              {receiptPreview && <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); }} style={{ marginTop: 4, fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>✕ Remove</button>}
            </div>

            {/* Warning */}
            <div style={{ margin: "0 20px 14px", padding: 11, borderRadius: 12, background: "#fef9c3", border: "1px solid #0f172a" }}>
              <p style={{ fontSize: 12, fontWeight: 700, textAlign: "center", color: "#854d0e" }}>⚠️ This will deduct {formatCurrency(totalAmount)} from the selected account</p>
            </div>

            {error && (
              <div style={{ margin: "0 20px 10px", padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1.5px solid #fca5a5" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", margin: 0 }}>⚠️ {error}</p>
              </div>
            )}

            {/* Buttons */}
            <div style={{ padding: "0 20px 20px", display: "flex", gap: 10 }}>
              <button onClick={() => setStep(null)} disabled={saving} className="btn-cancel" style={{ flex: 1 }}>← Back</button>
              <button
                onClick={() => {
                  const bankId = selectedBank || item.bank_account_id;
                  if (!bankId) { setError("Please select a bank account."); return; }
                  handleConfirm({ bankId, totalAmount, receiptFile });
                }}
                disabled={!selectedBank || lowBalance || saving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, background: saving ? "#93c5fd" : "linear-gradient(135deg, #2563EB, #1d4ed8)", color: "white", border: "none", cursor: (saving || !selectedBank || lowBalance) ? "not-allowed" : "pointer", opacity: (!selectedBank || lowBalance || saving) ? 0.6 : 1 }}>
                {saving ? "Processing..." : "Confirm & Deduct"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}