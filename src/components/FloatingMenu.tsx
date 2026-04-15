'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface FloatingMenuProps {
  isOpen: boolean
  anchorId: string
  minWidth?: number
  offset?: number
  onClose?: () => void
  children: ReactNode
}

export default function FloatingMenu({
  isOpen,
  anchorId,
  minWidth = 180,
  offset = 6,
  onClose,
  children,
}: FloatingMenuProps) {
  useEffect(() => {
    if (!isOpen) return

    const closeMenu = () => onClose?.()

    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)

    return () => {
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [isOpen, onClose])

  if (!isOpen || typeof window === 'undefined') return null

  const anchor = document.getElementById(anchorId)
  if (!anchor) return null

  const rect = anchor.getBoundingClientRect()
  const viewportPadding = 8
  const estimatedHeight = 220

  const isAnchorOutOfView =
    rect.bottom < 0 ||
    rect.top > window.innerHeight ||
    rect.right < 0 ||
    rect.left > window.innerWidth

  if (isAnchorOutOfView) return null

  const left = Math.min(
    Math.max(viewportPadding, rect.right - minWidth),
    Math.max(viewportPadding, window.innerWidth - minWidth - viewportPadding)
  )

  const showAbove = rect.bottom + offset + estimatedHeight > window.innerHeight && rect.top > estimatedHeight / 2
  const top = showAbove ? Math.max(viewportPadding, rect.top - offset) : rect.bottom + offset

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 9999,
        minWidth,
        background: 'white',
        border: '1.5px solid #0f172a',
        borderRadius: 12,
        boxShadow: '0 8px 28px rgba(15,23,42,0.22)',
        overflow: 'hidden',
        transform: showAbove ? 'translateY(-100%)' : 'none',
      }}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}
