import { DEFAULT_PROJECT } from '@/services/ideaStorage'
import type { Idea, IdeaProject, IdeaTag } from '@/types/idea'

export function findIdeaProject(idea: Pick<Idea, 'projectId'>, projects: IdeaProject[]): IdeaProject {
  return projects.find((project) => project.id === idea.projectId) || DEFAULT_PROJECT
}

export function findProjectById(projectId: string, projects: IdeaProject[]): IdeaProject {
  return projects.find((project) => project.id === projectId) || DEFAULT_PROJECT
}

export function findIdeaTags(idea: Pick<Idea, 'tagIds'>, tags: IdeaTag[]): IdeaTag[] {
  const selected = new Set(idea.tagIds)
  return tags.filter((tag) => selected.has(tag.id))
}

export function toggleTagId(tagIds: string[], tagId: string): string[] {
  return tagIds.includes(tagId) ? tagIds.filter((id) => id !== tagId) : [...tagIds, tagId]
}
