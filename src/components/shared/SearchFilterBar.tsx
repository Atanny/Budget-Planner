"use client";
import { useRef } from "react";
import { Search, Calendar } from "lucide-react";

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  onSearch: () => void;
  fromDate?: string;
  toDate?: string;
  onFromDateChange?: (v: string) => void;
  onToDateChange?: (v: string) => void;
  onDateSearch?: () => void;
  onClearDates?: () => void;
  placeholder?: string;
}

const BTN_COLOR = "#4F46E5";

export default function SearchFilterBar({
  searchValue, onSearchChange, onSearch,
  fromDate, toDate, onFromDateChange, onToDateChange,
  onDateSearch, onClearDates,
  placeholder = "Search Item",
}: SearchFilterBarProps) {
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef   = useRef<HTMLInputElement>(null);

  function openPicker(ref: React.RefObject<HTMLInputElement>) {
    try {
      ref.current?.showPicker();
    } catch {
      ref.current?.focus();
      ref.current?.click();
    }
  }

  const dateInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 36px 9px 12px",
    borderRadius: 10,
    fontSize: 13,
    fontFamily: "Nunito, sans-serif",
    border: "1.5px solid #E2E8F0",
    background: "white",
    color: "var(--text-primary)",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Search row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{
            position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
            color: "#B0B8C8", pointerEvents: "none", display: "flex",
          }}>
            <Search size={15} />
          </span>
          <input
            type="text"
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onSearch()}
            placeholder={placeholder}
            style={{
              width: "100%",
              padding: "11px 14px 11px 38px",
              borderRadius: 999,
              fontFamily: "Nunito, sans-serif",
              fontSize: 14,
              border: "1.5px solid #E2E8F0",
              outline: "none",
              background: "white",
            }}
          />
        </div>
        <button
          onClick={onSearch}
          style={{
            background: BTN_COLOR,
            color: "white",
            border: "none",
            borderRadius: 999,
            padding: "11px 20px",
            fontFamily: "Nunito, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            boxShadow: "0 3px 10px rgba(79,70,229,0.25)",
            flexShrink: 0,
          }}
        >
          <Search size={14} /> Search
        </button>
      </div>

      {/* Date filter row */}
      {onFromDateChange && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", flexShrink: 0 }}>From</span>

          {/* From date */}
          <div style={{ flex: 1, position: "relative" }}>
            <input
              ref={fromRef}
              type="date"
              value={fromDate || ""}
              onChange={e => onFromDateChange?.(e.target.value)}
              style={dateInputStyle}
            />
            <button
              type="button"
              onClick={() => openPicker(fromRef)}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", padding: 2, cursor: "pointer",
                display: "flex", alignItems: "center", color: BTN_COLOR, zIndex: 1,
              }}
            >
              <Calendar size={14} />
            </button>
          </div>

          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", flexShrink: 0 }}>To</span>

          {/* To date */}
          <div style={{ flex: 1, position: "relative" }}>
            <input
              ref={toRef}
              type="date"
              value={toDate || ""}
              onChange={e => onToDateChange?.(e.target.value)}
              style={dateInputStyle}
            />
            <button
              type="button"
              onClick={() => openPicker(toRef)}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", padding: 2, cursor: "pointer",
                display: "flex", alignItems: "center", color: BTN_COLOR, zIndex: 1,
              }}
            >
              <Calendar size={14} />
            </button>
          </div>

          {/* Date search — only fires on click, not on date change */}
          <button
            onClick={onDateSearch}
            title="Search by date range"
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: BTN_COLOR,
              border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "white", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(79,70,229,0.25)",
            }}
          >
            <Search size={15} />
          </button>

          {/* Clear button — only shown when a date is active */}
          {(fromDate || toDate) && (
            <button
              onClick={onClearDates}
              title="Clear dates"
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: "#FEF2F2",
                border: "1.5px solid #FECACA",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#DC2626", flexShrink: 0,
                fontSize: 16, fontWeight: 700, lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}