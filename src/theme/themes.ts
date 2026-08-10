import type { CSSProperties } from 'react'
import type { PriorityKey } from '@/types/idea'

export type ThemeId = 'glimmer-night' | 'twilight-violet' | 'paper-dawn'

export type IdeaColorSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type IdeaPalette = readonly [string, string, string, string, string, string, string]

interface ThemeColors {
  stage: string
  page: string
  pageRgb: string
  surfaceLow: string
  surface: string
  surfaceHigh: string
  surfaceControl: string
  surfaceRaised: string
  surfaceStrong: string
  surfaceDisabled: string
  surfaceRgb: string
  surfaceLowRgb: string
  surfaceHighRgb: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textDisabled: string
  textSoft: string
  accentHigh: string
  accent: string
  accentLow: string
  accentDeep: string
  accentRgb: string
  onAccent: string
  ambientA: string
  ambientB: string
  highlightRgb: string
  borderRgb: string
  shadowRgb: string
  glassTop: string
  glassMid: string
  glassDeep: string
  glassShadeRgb: string
  glassEdgeRgb: string
  glassBrightness: string
  glassContrast: string
  danger: string
  dangerRgb: string
}

interface CanvasColors {
  linkRgb: string
  tooltipBackground: string
  tooltipBorder: string
  tooltipText: string
}

export interface ThemeDefinition {
  id: ThemeId
  name: string
  description: string
  colors: ThemeColors
  priorities: Record<PriorityKey, string>
  ideaPalette: IdeaPalette
  canvas: CanvasColors
}

export type ThemeStyle = CSSProperties & Record<`--${string}`, string>

export const DEFAULT_THEME_ID: ThemeId = 'glimmer-night'

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  'glimmer-night': {
    id: 'glimmer-night',
    name: '荧光夜',
    description: '克制的深色空间与荧光微光',
    colors: {
      stage: '#020304',
      page: '#07090d',
      pageRgb: '7, 9, 13',
      surfaceLow: '#0d1016',
      surface: '#141820',
      surfaceHigh: '#191d26',
      surfaceControl: '#11151c',
      surfaceRaised: '#171b24',
      surfaceStrong: '#222732',
      surfaceDisabled: '#20252d',
      surfaceRgb: '20, 24, 32',
      surfaceLowRgb: '13, 16, 22',
      surfaceHighRgb: '25, 29, 38',
      textPrimary: '#f0f2f6',
      textSecondary: '#aeb5c1',
      textMuted: '#858e9d',
      textDisabled: '#626a77',
      textSoft: '#dfe3ea',
      accentHigh: '#eaff7d',
      accent: '#dcfa66',
      accentLow: '#c7e94b',
      accentDeep: '#8da61f',
      accentRgb: '220, 250, 102',
      onAccent: '#0a0c0d',
      ambientA: '#7182ff',
      ambientB: '#d8ff62',
      highlightRgb: '255, 255, 255',
      borderRgb: '255, 255, 255',
      shadowRgb: '0, 0, 0',
      glassTop: '55, 63, 75',
      glassMid: '24, 29, 37',
      glassDeep: '8, 11, 16',
      glassShadeRgb: '0, 0, 0',
      glassEdgeRgb: '238, 246, 255',
      glassBrightness: '.80',
      glassContrast: '1.14',
      danger: '#ff7b80',
      dangerRgb: '255, 91, 97'
    },
    priorities: {
      inbox: '#969eae',
      urgent: '#ff5b61',
      important: '#ffab58',
      quick: '#69a8ff'
    },
    ideaPalette: ['#9da9ff', '#d5ff6d', '#7bd9d4', '#ffba78', '#c8a3ff', '#7ec8ff', '#ff91ad'],
    canvas: {
      linkRgb: '135, 148, 179',
      tooltipBackground: 'rgba(15, 18, 24, 0.94)',
      tooltipBorder: 'rgba(255, 255, 255, 0.07)',
      tooltipText: '#dfe3ea'
    }
  },
  'twilight-violet': {
    id: 'twilight-violet',
    name: '暮光紫',
    description: '安静的紫罗兰与冰蓝星光',
    colors: {
      stage: '#05040a',
      page: '#0c0914',
      pageRgb: '12, 9, 20',
      surfaceLow: '#12101c',
      surface: '#191625',
      surfaceHigh: '#211d30',
      surfaceControl: '#171321',
      surfaceRaised: '#211d30',
      surfaceStrong: '#28223a',
      surfaceDisabled: '#282335',
      surfaceRgb: '25, 22, 37',
      surfaceLowRgb: '18, 16, 28',
      surfaceHighRgb: '33, 29, 48',
      textPrimary: '#f6f2ff',
      textSecondary: '#c5bdd5',
      textMuted: '#968da8',
      textDisabled: '#6d647c',
      textSoft: '#eee8fa',
      accentHigh: '#cfc2ff',
      accent: '#a78bfa',
      accentLow: '#8b6ce8',
      accentDeep: '#6d4fc2',
      accentRgb: '167, 139, 250',
      onAccent: '#100b1c',
      ambientA: '#8b5cf6',
      ambientB: '#60a5fa',
      highlightRgb: '238, 232, 255',
      borderRgb: '238, 232, 255',
      shadowRgb: '6, 4, 10',
      glassTop: '69, 55, 93',
      glassMid: '34, 28, 48',
      glassDeep: '12, 9, 18',
      glassShadeRgb: '6, 4, 10',
      glassEdgeRgb: '224, 214, 255',
      glassBrightness: '.80',
      glassContrast: '1.14',
      danger: '#ff6b81',
      dangerRgb: '255, 107, 129'
    },
    priorities: {
      inbox: '#a7a0b8',
      urgent: '#ff6b81',
      important: '#f2b86b',
      quick: '#77b7ff'
    },
    ideaPalette: ['#a78bfa', '#c4b5fd', '#7dd3fc', '#67e8f9', '#f0abfc', '#fdba74', '#fb7185'],
    canvas: {
      linkRgb: '155, 139, 196',
      tooltipBackground: 'rgba(21, 17, 31, 0.94)',
      tooltipBorder: 'rgba(238, 232, 255, 0.08)',
      tooltipText: '#eee8fa'
    }
  },
  'paper-dawn': {
    id: 'paper-dawn',
    name: '晨光纸',
    description: '温暖纸色与清醒的蓝紫笔迹',
    colors: {
      stage: '#e7e5df',
      page: '#f7f5ef',
      pageRgb: '247, 245, 239',
      surfaceLow: '#eceae3',
      surface: '#ffffff',
      surfaceHigh: '#f3f0e8',
      surfaceControl: '#ffffff',
      surfaceRaised: '#ffffff',
      surfaceStrong: '#e9e6dc',
      surfaceDisabled: '#e3e1da',
      surfaceRgb: '255, 255, 255',
      surfaceLowRgb: '236, 234, 227',
      surfaceHighRgb: '243, 240, 232',
      textPrimary: '#1c2430',
      textSecondary: '#465263',
      textMuted: '#647083',
      textDisabled: '#89919e',
      textSoft: '#2f3a49',
      accentHigh: '#7286ff',
      accent: '#4f63d8',
      accentLow: '#3d50bd',
      accentDeep: '#2e3d93',
      accentRgb: '79, 99, 216',
      onAccent: '#ffffff',
      ambientA: '#9bb6ff',
      ambientB: '#ffd991',
      highlightRgb: '255, 255, 255',
      borderRgb: '48, 58, 74',
      shadowRgb: '55, 62, 73',
      glassTop: '255, 255, 255',
      glassMid: '250, 251, 253',
      glassDeep: '239, 243, 249',
      glassShadeRgb: '255, 255, 255',
      glassEdgeRgb: '255, 255, 255',
      glassBrightness: '1.04',
      glassContrast: '1.03',
      danger: '#c43d52',
      dangerRgb: '196, 61, 82'
    },
    priorities: {
      inbox: '#6d7787',
      urgent: '#d8465c',
      important: '#b26a16',
      quick: '#3f72c8'
    },
    ideaPalette: ['#6e7ff2', '#f2b544', '#39ab8e', '#e98645', '#9a6fe3', '#4a96d9', '#e45f87'],
    canvas: {
      linkRgb: '112, 120, 135',
      tooltipBackground: 'rgba(42, 48, 59, 0.94)',
      tooltipBorder: 'rgba(255, 255, 255, 0.12)',
      tooltipText: '#f8f9fb'
    }
  }
}

export const DEFAULT_THEME = THEMES[DEFAULT_THEME_ID]
export const DEFAULT_PAGE_BACKGROUND = DEFAULT_THEME.colors.page

export const THEME_OPTIONS = Object.values(THEMES)

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in THEMES
}

export function getThemeStyle(theme: ThemeDefinition): ThemeStyle {
  const { colors } = theme
  return {
    '--stage-bg': colors.stage,
    '--page-bg': colors.page,
    '--page-bg-rgb': colors.pageRgb,
    '--surface-low': colors.surfaceLow,
    '--surface': colors.surface,
    '--surface-high': colors.surfaceHigh,
    '--surface-control': colors.surfaceControl,
    '--surface-raised': colors.surfaceRaised,
    '--surface-strong': colors.surfaceStrong,
    '--surface-disabled': colors.surfaceDisabled,
    '--surface-rgb': colors.surfaceRgb,
    '--surface-low-rgb': colors.surfaceLowRgb,
    '--surface-high-rgb': colors.surfaceHighRgb,
    '--text-primary': colors.textPrimary,
    '--text-secondary': colors.textSecondary,
    '--text-muted': colors.textMuted,
    '--text-disabled': colors.textDisabled,
    '--text-soft': colors.textSoft,
    '--accent-high': colors.accentHigh,
    '--accent': colors.accent,
    '--accent-low': colors.accentLow,
    '--accent-deep': colors.accentDeep,
    '--accent-rgb': colors.accentRgb,
    '--on-accent': colors.onAccent,
    '--ambient-a': colors.ambientA,
    '--ambient-b': colors.ambientB,
    '--highlight-rgb': colors.highlightRgb,
    '--border-rgb': colors.borderRgb,
    '--shadow-rgb': colors.shadowRgb,
    '--glass-top': colors.glassTop,
    '--glass-mid': colors.glassMid,
    '--glass-deep': colors.glassDeep,
    '--glass-shade-rgb': colors.glassShadeRgb,
    '--glass-edge-rgb': colors.glassEdgeRgb,
    '--glass-brightness': colors.glassBrightness,
    '--glass-contrast': colors.glassContrast,
    '--danger': colors.danger,
    '--danger-rgb': colors.dangerRgb
  }
}

export function normalizeColorSlot(value: unknown, id: string): IdeaColorSlot {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 7) {
    return value as IdeaColorSlot
  }
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0
  }
  return (Math.abs(hash) % 7) as IdeaColorSlot
}
