const THEME_KEY = 'vanna-theme'

type Theme = 'light' | 'dark'

export const getStoredTheme = (): Theme => {
  if (typeof localStorage === 'undefined') return 'light'
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

export const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  localStorage.setItem(THEME_KEY, theme)
}
