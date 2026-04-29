"use client";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS_LONG = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const CURRENT_YEAR = new Date().getFullYear();

interface MonthNavProps {
  viewMonth: number;
  viewYear: number;
  onPrev: () => void;
  onNext: () => void;
  onSelectMonth: (month: number) => void;
}

export default function MonthNav({
  viewMonth, viewYear, onPrev, onNext, onSelectMonth,
}: MonthNavProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos]   = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* Month label button */}
      

      {/* Prev / Next */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button
          onClick={onPrev}
          style={{ width: 34, height: 34, borderRadius: "50%", background: "#2563EB", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft size={17} />
        </button>
        <button
        ref={btnRef}
        onClick={() => {
          if (!showPicker && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setPickerPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
          }
          setShowPicker(v => !v);
        }}
        style={{
          display: "inline-flex", alignItems: "center",
          fontWeight: 700, fontSize: 12, color: "var(--text-primary)",
          background: "#fff",
          border: showPicker ? "1px solid #2563EB" : "1px solid #E5E7EB",
          borderRadius: 20, padding: "7px 14px",
          cursor: "pointer", whiteSpace: "nowrap", gap: 6,
        }}
      >
        {MONTHS_LONG[viewMonth]}{viewYear !== CURRENT_YEAR ? ` ${viewYear}` : ""}
      </button>
        <button
          onClick={onNext}
          style={{ width: 34, height: 34, borderRadius: "50%", background: "#2563EB", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronRight size={17} />
        </button>
      </div>

      {/* Month picker dropdown */}
      {showPicker && (
        <MonthPickerDropdown
          top={pickerPos.top}
          right={pickerPos.right}
          viewMonth={viewMonth}
          onSelect={(i) => { onSelectMonth(i); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function MonthPickerDropdown({
  top, right, viewMonth, onSelect, onClose,
}: { top: number; right: number; viewMonth: number; onSelect: (i: number) => void; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("resize",  close);
    window.addEventListener("scroll",  close, true);
    return () => {
      window.removeEventListener("resize",  close);
      window.removeEventListener("scroll",  close, true);
    };
  }, [onClose]);

  return (
    <div style={{ position: "fixed", top, right, zIndex: 9999 }}>
      <div style={{
        background: "white", border: "1.5px solid #0f172a",
        borderRadius: 12, boxShadow: "0 8px 28px rgba(15,23,42,0.22)",
        padding: 8, minWidth: 200,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
          {MONTHS_LONG.map((m, i) => (
            <button
              key={m}
              onClick={() => onSelect(i)}
              style={{
                padding: "10px 8px", fontSize: 13, fontFamily: "Poppins, sans-serif",
                borderRadius: 8,
                border: i === viewMonth ? "1.5px solid #2563EB" : "1.5px solid transparent",
                background: i === viewMonth ? "#eff6ff" : "white",
                color: i === viewMonth ? "#2563EB" : "#0f172a",
                fontWeight: i === viewMonth ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
