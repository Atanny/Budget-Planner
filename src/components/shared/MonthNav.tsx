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
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {/* Prev arrow */}
      <button
        onClick={onPrev}
        style={{
          width: 34, height: 34, borderRadius: 10,
          background: "white",
          border: "1.5px solid #6D28D9",
          color: "#6D28D9",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ChevronLeft size={17} />
      </button>

      {/* Month label */}
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
          fontWeight: 700, fontSize: 13, color: "#6D28D9",
          background: "white",
          border: showPicker ? "1.5px solid #2563EB" : "1.5px solid #6D28D9",
          borderRadius: 10, padding: "7px 16px",
          cursor: "pointer", whiteSpace: "nowrap", gap: 6,
        }}
      >
        {MONTHS_LONG[viewMonth]}{viewYear !== CURRENT_YEAR ? ` ${viewYear}` : ""}
      </button>

      {/* Next arrow */}
      <button
        onClick={onNext}
        style={{
          width: 34, height: 34, borderRadius: 10,
          background: "white",
          border: "1.5px solid #6D28D9",
          color: "#6D28D9",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ChevronRight size={17} />
      </button>

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
        background: "white", border: "1.5px solid #E2E8F0",
        borderRadius: 14, boxShadow: "0 8px 32px rgba(15,23,42,0.12)",
        padding: 10, minWidth: 210,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {MONTHS_LONG.map((m, i) => (
            <button
              key={m}
              onClick={() => onSelect(i)}
              style={{
                padding: "10px 8px", fontSize: 13, fontFamily: "Nunito, sans-serif",
                borderRadius: 10,
                border: i === viewMonth ? "1.5px solid #6D28D9" : "1.5px solid #E2E8F0",
                background: i === viewMonth ? "linear-gradient(135deg, #6D28D9, #2563EB)" : "white",
                color: i === viewMonth ? "white" : "#374151",
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
