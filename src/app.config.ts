import { DEFAULT_PAGE_BACKGROUND } from './theme/themes'

export default defineAppConfig({
  pages: ['pages/index/index', 'pages/settings/index'],
  window: {
    backgroundTextStyle: 'light',
    navigationStyle: 'custom',
    backgroundColor: DEFAULT_PAGE_BACKGROUND
  }
})
