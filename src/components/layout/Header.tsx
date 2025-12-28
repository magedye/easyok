import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRightEndOnRectangleIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/shared/Button'

interface HeaderProps {
  onToggleSidebar?: () => void
}

export const Header = ({ onToggleSidebar }: HeaderProps) => {
  const { user, logout } = useAuthStore()
  const { t, i18n } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const displayName = user?.fullName ?? user?.username ?? t('common.user')

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
    setShowLanguageMenu(false)
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-neutral-100 bg-white/80 px-6 py-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="rounded-full border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
          >
            <span className="sr-only">Toggle navigation</span>
            ☰
          </button>
        )}
        <div>
          <p className="text-sm text-neutral-500">Vanna Insight Engine</p>
          <p className="text-lg font-semibold text-neutral-900 dark:text-white">{displayName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="flex items-center gap-2 rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            🌐
            <span>{i18n.language.toUpperCase()}</span>
          </button>
          {showLanguageMenu && (
            <div className="absolute right-0 mt-2 w-32 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg">
              <button
                onClick={() => changeLanguage('en')}
                className={`block w-full text-left px-4 py-2 text-sm ${
                  i18n.language === 'en'
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                }`}
              >
                English
              </button>
              <button
                onClick={() => changeLanguage('ar')}
                className={`block w-full text-left px-4 py-2 text-sm ${
                  i18n.language === 'ar'
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                }`}
              >
                العربية
              </button>
            </div>
          )}
        </div>
        
        <Button
          variant="ghost"
          className="text-neutral-600 dark:text-neutral-200"
          onClick={toggleTheme}
          aria-label={t('actions.theme')}
        >
          {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          onClick={logout}
          aria-label={t('actions.logout')}
        >
          <ArrowRightEndOnRectangleIcon className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
