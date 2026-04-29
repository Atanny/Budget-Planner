"use client";
import { useState } from "react";
import { X, Upload } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CreditPayModalProps {
  credit: { id: string; name: string; amount: number; source: string } | null;
  rowType: "used" | "due" | null;
  banks: { id: string; name: string; balance: number; color?: string; is_credit?: boolean }[];
  onClose: () => void;
  onConfirm: (params: {
    creditId: string;
    rowType: "used" | "due";
    bankId: string;
    receiptFile: File | null;
    transferFee: number;
  }) => Promise<void>;
}

export default function CreditPayModal({ credit, rowType, banks, onClose, onConfirm }: CreditPayModalProps) {
  const [selectedBank, setSelectedBank] = useState("");
  const [transferFee, setTransferFee] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!credit || !rowType) return null;

  const fee = parseFloat(transferFee) || 0;
  const totalAmount = credit.amount + fee;
  const selectedBankObj = banks.find(b => b.id === selectedBank);
  const lowBalance = !!(selectedBankObj && selectedBankObj.balance < totalAmount);
  const canSubmit = !!selectedBank && !lowBalance && !saving;

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setReceiptFile(f);
      setReceiptPreview(URL.createObjectURL(f));
    }
  }

  async function handleSubmit() {
    if (!canSubmit || !credit || !rowType) return;
    setSaving(true);
    try {
      await onConfirm({
        creditId: credit.id,
        rowType,
        bankId: selectedBank,
        receiptFile,
        transferFee: fee,
      });
    } catch (err) {
      console.error(err);
      alert("Payment failed. Check console.");
    }
    setSaving(false);
  }

  const title = rowType === "used" ? "Mark Used as Paid" : "Mark Due as Paid";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.45)", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400, borderRadius: 20, overflow: "hidden", background: "white", border: "1.5px solid #0f172a", boxShadow: "0 8px 32px rgba(15,23,42,0.18)" }}>
        
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: rowType === "used" ? "#eff6ff" : "#f0fdf4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontWeight: 800, color: rowType === "used" ? "#1e40af" : "#14532d", margin: 0, fontSize: 16 }}>{title}</h2>
            <p style={{ fontSize: 12, color: rowType === "used" ? "#3b82f6" : "#16a34a", margin: "2px 0 0" }}>{credit.name} — {formatCurrency(credit.amount)}</p>
          </div>
          <button onClick={onClose} style={{ padding: 6, background: "none", border: "none", cursor: "pointer" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          
          {/* Bank selector */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block", color: "#64748b" }}>
              Pay from which account? *
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {banks.filter(b => !b.is_credit).map(b => {
                const selected = selectedBank === b.id;
                return (
                  <button key={b.id} onClick={() => setSelectedBank(b.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${selected ? "#2563EB" : "#e2e8f0"}`, background: selected ? "#eff6ff" : "#f8fafc", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color || "#2563EB", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: selected ? "#1d4ed8" : "#1e293b", margin: 0 }}>{b.name}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", fontFamily: "monospace" }}>{formatCurrency(b.balance)}</span>
                    {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }} />}
                  </button>
                );
              })}
            </div>
            {lowBalance && (
              <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1.5px solid #fca5a5" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", margin: 0 }}>⚠️ Insufficient balance</p>
              </div>
            )}
          </div>

          {/* Transfer fee */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block", color: "#64748b" }}>
              Transfer Fee <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>
            </label>
            <input type="number" value={transferFee} onChange={e => setTransferFee(e.target.value)} placeholder="0.00"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13, border: "1.5px solid #0f172a", background: "#f8fafc", color: "#1e293b", outline: "none" }} />
            {fee > 0 && <p style={{ fontSize: 11, marginTop: 5, color: "#854d0e", fontWeight: 600 }}>Total: {formatCurrency(totalAmount)}</p>}
          </div>

          {/* Receipt upload */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block", color: "#64748b" }}>
              Payment Receipt <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: receiptPreview ? 6 : "10px 12px", borderRadius: 10, border: `2px dashed ${receiptPreview ? "#16a34a" : "#93c5fd"}`, background: receiptPreview ? "#f0fdf4" : "#f8faff", cursor: "pointer" }}>
              {receiptPreview ? <img src={receiptPreview} alt="Receipt" style={{ height: 48, borderRadius: 6, objectFit: "contain" }} /> : <><Upload size={16} color="#93c5fd" /><span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>Tap to attach receipt</span></>}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleReceiptChange} />
            </label>
            {receiptPreview && <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); }} style={{ marginTop: 4, fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>✕ Remove</button>}
          </div>

          <div style={{ padding: 11, borderRadius: 12, background: "#fef9c3", border: "1px solid #0f172a" }}>
            <p style={{ fontSize: 12, fontWeight: 700, textAlign: "center", color: "#854d0e" }}>
              ⚠️ Deduct {formatCurrency(totalAmount)} from selected account
            </p>
          </div>
        </div>

        <div style={{ padding: "12px 20px 20px", display: "flex", gap: 10, borderTop: "1px solid #e2e8f0" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "#f1f5f9", color: "#64748b", border: "1.5px solid #0f172a", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ flex: 2, padding: "10px 0", borderRadius: 999, fontSize: 13, fontWeight: 700, color: "white", background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.4 }}>
            {saving ? "Processing..." : "✓ Confirm Paid"}
          </button>
        </div>
      </div>
    </div>
  );
}