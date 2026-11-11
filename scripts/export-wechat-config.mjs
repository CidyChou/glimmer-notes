import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const output = 'dist-wechat/project.config.json'
const config = JSON.parse(readFileSync('project.config.json', 'utf8'))
const existing = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : {}
const defaultAppId = config.appid === 'touristappid' ? existing.appid || config.appid : config.appid

const exported = {
  ...config,
  ...existing,
  appid: process.env.WECHAT_APP_ID || defaultAppId,
  miniprogramRoot: './',
  setting: { ...config.setting, ...existing.setting, compileHotReLoad: false }
}

writeFileSync(output, JSON.stringify(exported, null, 2) + '\n')
