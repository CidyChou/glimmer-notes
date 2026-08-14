import path from 'path'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import devConfig from './dev'
import prodConfig from './prod'

export default defineConfig<'webpack5'>(async (merge, { command }) => {
  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'idea-space',
    date: '2026-08-10',
    designWidth: 375,
    deviceRatio: {
      // CSS is authored against a 375px phone canvas. Convert 1px to 2rpx
      // so the mini program keeps the same physical size as the H5 build.
      375: 2,
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {
      __API_BASE_URL__: JSON.stringify(process.env.TARO_APP_API_BASE_URL || 'http://106.55.78.71:8769')
    },
    copy: {
      patterns: [],
      options: {}
    },
    framework: 'react',
    compiler: 'webpack5',
    alias: {
      '@': path.resolve(__dirname, '..', 'src')
    },
    cache: {
      enable: true
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      postcss: {
        pxtransform: {
          enable: true,
          config: {
            // Keep the phone canvas fluid, but stop wide desktop screens from
            // scaling every control up to twice its authored size.
            maxRootSize: 22
          }
        },
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      }
    }
  }

  return merge({}, baseConfig, command === 'build' ? prodConfig : devConfig)
})
