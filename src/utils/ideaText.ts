export interface IdeaContent {
  title: string
  details: string
}

export function splitIdeaText(value: string): IdeaContent {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  const [title = '', ...detailLines] = normalized.split('\n')

  return {
    title: title.trim(),
    details: detailLines.join('\n').trim()
  }
}

export function composeIdeaText(title: string, details: string): string {
  const cleanTitle = title.trim()
  const cleanDetails = details.trim()
  return cleanDetails ? `${cleanTitle}\n${cleanDetails}` : cleanTitle
}

export function getIdeaTitle(value: string): string {
  return splitIdeaText(value).title || '未命名任务'
}
