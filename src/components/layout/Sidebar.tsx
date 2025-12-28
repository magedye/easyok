import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChartBarSquareIcon,
  ClockIcon,
  ShieldCheckIcon,
  Cog8ToothIcon,
  RectangleStackIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import clsx from 'classnames'
import { useAuth } from '@/context/AuthContext'
import { hasPermission } from '@/utils/catalogPermissions'

const navItems = [
  { to: '/dashboard', icon: ChartBarSquareIcon, labelKey: 'sidebar.dashboard', accent: 'blue' },
  { to: '/history', icon: ClockIcon, labelKey: 'sidebar.history', accent: 'amber' },
  { to: '/admin', icon: ShieldCheckIcon, labelKey: 'sidebar.admin', accent: 'emerald' },
  { to: '/observability', icon: EyeIcon, labelKey: 'sidebar.observability', accent: 'violet' },
  { to: '/schema', icon: RectangleStackIcon, labelKey: 'sidebar.schema', accent: 'rose' },
  { to: '/settings', icon: Cog8ToothIcon, labelKey: 'sidebar.settings', accent: 'slate' },
]

const accentStyles: Record<
  string,
  {
    icon: string
    text: string
    activeLink: string
  }
> = {
  blue: {
    icon: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-200',
    text: 'text-blue-600 dark:text-blue-200',
    activeLink: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200/40',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-200',
    text: 'text-amber-600 dark:text-amber-200',
    activeLink: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-200/40',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-200',
    text: 'text-emerald-600 dark:text-emerald-200',
    activeLink: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-200/40',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-200',
    text: 'text-violet-600 dark:text-violet-200',
    activeLink: 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-violet-200/40',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-200',
    text: 'text-rose-600 dark:text-rose-200',
    activeLink: 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-rose-200/40',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100',
    text: 'text-slate-600 dark:text-slate-200',
    activeLink: 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-slate-200/40',
  },
}

interface SidebarProps {
  isOpen?: boolean
}

export const Sidebar = ({ isOpen = true }: SidebarProps) => {
  const { t } = useTranslation()
  const { user } = useAuth()

  const visibleNavItems = navItems.filter((item) => {
    if (item.to !== '/admin') return true
    // Only show admin link if the user has catalog admin view permission
    return user?.role === 'admin' && hasPermission('admin', 'canView')
  })

  return (
    <aside
      className={clsx(
        'flex w-72 flex-col gap-6 border-s border-neutral-100 bg-white/90 px-4 py-6 backdrop-blur transition-transform dark:border-neutral-800 dark:bg-neutral-900/80 lg:translate-x-0',
        isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
      )}
    >
      <div className="text-center">
        <p className="text-2xl font-black tracking-wide text-neutral-900 dark:text-white">
          Vanna Insight Engine
        </p>
      </div>
      <nav className="space-y-1">
        {visibleNavItems.map(({ to, icon: Icon, labelKey, accent }) => {
          const accentClass = accentStyles[accent] ?? accentStyles.blue
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center justify-between rounded-3xl px-4 py-4 text-base font-semibold transition-all shadow-sm',
                  isActive
                    ? `${accentClass.activeLink} shadow-lg`
                    : 'bg-white/50 text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:bg-neutral-800',
                )
              }
            >
              <span className="flex items-center gap-3">
                <span
                  className={clsx(
                    'flex h-12 w-12 items-center justify-center rounded-2xl text-xl transition-all',
                    accentClass.icon,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>{t(labelKey)}</span>
              </span>
              <span
                aria-hidden="true"
                className={clsx('text-lg font-bold transition-colors', accentClass.text)}
              >
                ›
              </span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
