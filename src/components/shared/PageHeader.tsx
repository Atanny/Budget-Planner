import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle: string
  icon: React.ReactNode
}

export default function PageHeader({ title, subtitle, icon }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-icon">
        {icon}
      </div>
      <div>
        <h1 className="page-header-title">{title}</h1>
        <p className="page-header-subtitle">{subtitle}</p>
      </div>
    </div>
  )
}
