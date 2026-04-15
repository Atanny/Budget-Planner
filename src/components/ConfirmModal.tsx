'use client'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface Props {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen, title, message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm, onCancel
}: Props) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center modal-overlay p-4"
      style={{}}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-surface)',
          border: '1.5px solid #0f172a',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          animation: 'slide-up 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon header */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: danger ? 'var(--brand-pale)' : '#dbeafe',
              border: `2px solid ${danger ? 'var(--brand-muted)' : '#93c5fd'}`,
            }}
          >
            {danger
              ? <Trash2 size={28} style={{ color: 'var(--brand-dark)' }} />
              : <AlertTriangle size={28} style={{ color: '#2563eb' }} />
            }
          </div>
          <h2 className="text-lg font-bold text-center" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <p className="text-sm text-center mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{message}</p>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        <div className="flex gap-3 p-5" style={{ background: 'var(--bg-subtle)' }}>
          <button
            onClick={onCancel}
            className="flex-1 py-3 text-sm font-semibold transition-colors"
            style={{
              color: 'var(--text-secondary)',
              background: 'white',
              border: '1.5px solid var(--border-dark)',
              borderRadius: 12,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 text-sm font-bold transition-colors"
            style={{
              color: danger ? '#ffffff' : 'white',
              background: danger ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              border: 'none',
              borderRadius: 12,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
