import Taro from '@tarojs/taro'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import {
  DEFAULT_THEME_ID,
  THEMES,
  getThemeStyle,
  isThemeId
} from './themes'
import type { ThemeDefinition, ThemeId, ThemeStyle } from './themes'

const THEME_STORAGE_KEY = 'idea-space-theme-v1'

interface ThemeContextValue {
  themeId: ThemeId
  theme: ThemeDefinition
  themeStyle: ThemeStyle
  setTheme: (themeId: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function loadThemeId(): ThemeId {
  try {
    const stored = Taro.getStorageSync(THEME_STORAGE_KEY) as unknown
    return isThemeId(stored) ? stored : DEFAULT_THEME_ID
  } catch (error) {
    console.warn('[IdeaSpace] load theme failed', error)
    return DEFAULT_THEME_ID
  }
}

function syncPlatformBackground(theme: ThemeDefinition) {
  try {
    const result = Taro.setBackgroundColor?.({
      backgroundColor: theme.colors.page,
      backgroundColorTop: theme.colors.page,
      backgroundColorBottom: theme.colors.page
    })
    result?.catch?.(() => undefined)
  } catch {
    // Some H5 runtimes do not implement this mini-program API.
  }

  if (process.env.TARO_ENV === 'h5' && typeof document !== 'undefined') {
    document.documentElement.style.backgroundColor = theme.colors.page
    document.body.style.backgroundColor = theme.colors.page
  }
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeId, setThemeId] = useState<ThemeId>(loadThemeId)
  const theme = THEMES[themeId]
  const themeStyle = useMemo(() => getThemeStyle(theme), [theme])

  useEffect(() => {
    syncPlatformBackground(theme)
  }, [theme])

  const setTheme = useCallback((nextThemeId: ThemeId) => {
    setThemeId(nextThemeId)
    try {
      Taro.setStorageSync(THEME_STORAGE_KEY, nextThemeId)
    } catch (error) {
      console.warn('[IdeaSpace] save theme failed', error)
    }
  }, [])

  const value = useMemo(() => ({ themeId, theme, themeStyle, setTheme }), [themeId, theme, themeStyle, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}

