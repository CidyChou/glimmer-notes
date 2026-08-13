export interface IdeaContent {
  title: string
  details: string
}

export function splitIdeaText(value: string): IdeaContent {
  const normalized = value.replace(/\r\n?/g, '\n')
  const [title = '', ...detailLines] = normalized.split('\n')
  const details = detailLines.join('\n')

  return {
    title: title.trim(),
    details: details.trim() ? details : ''
  }
}

export function composeIdeaText(title: string, details: string): string {
  const cleanTitle = title.trim()
  const normalizedDetails = details.replace(/\r\n?/g, '\n')
  return normalizedDetails.trim() ? `${cleanTitle}\n${normalizedDetails}` : cleanTitle
}

export function getIdeaTitle(value: string): string {
  return splitIdeaText(value).title || '未命名任务'
}
