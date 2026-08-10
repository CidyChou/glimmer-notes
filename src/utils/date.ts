export function isToday(timestamp: number): boolean {
  return new Date(timestamp).toDateString() === new Date().toDateString()
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDay(timestamp: number): string {
  const date = new Date(timestamp)
  if (date.toDateString() === new Date().toDateString()) return '今天'
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

export function formatDetailTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
