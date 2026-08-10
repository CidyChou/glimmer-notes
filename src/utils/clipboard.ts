import Taro from '@tarojs/taro'

export async function copyText(value: string): Promise<void> {
  if (process.env.TARO_ENV === 'h5' && typeof document !== 'undefined') {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value)
        return
      }
    } catch {
      // Clipboard permissions vary between desktop browsers; use the focused-page fallback below.
    }
    const field = document.createElement('textarea')
    field.value = value
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(field)
    if (copied) return
  }
  await Taro.setClipboardData({ data: value })
}
