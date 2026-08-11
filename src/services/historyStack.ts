export type HistoryDirection = 'undo' | 'redo'

export interface HistoryStackState<T> {
  undo: T[]
  redo: T[]
}

export class HistoryStack<T> {
  private undoEntries: T[] = []
  private redoEntries: T[] = []

  constructor(private readonly maxEntries = 50) {}

  get state(): HistoryStackState<T> {
    return { undo: [...this.undoEntries], redo: [...this.redoEntries] }
  }

  clear(): void {
    this.undoEntries = []
    this.redoEntries = []
  }

  push(entry: T): void {
    this.undoEntries = [...this.undoEntries, entry].slice(-this.maxEntries)
    this.redoEntries = []
  }

  move(direction: HistoryDirection, isCurrent: (entry: T) => boolean): T | null {
    const source = direction === 'undo' ? this.undoEntries : this.redoEntries
    const entry = source[source.length - 1]
    if (!entry || !isCurrent(entry)) return null
    if (direction === 'undo') {
      this.undoEntries = source.slice(0, -1)
      this.redoEntries = [...this.redoEntries, entry]
    } else {
      this.redoEntries = source.slice(0, -1)
      this.undoEntries = [...this.undoEntries, entry].slice(-this.maxEntries)
    }
    return entry
  }

  filter(predicate: (entry: T) => boolean): void {
    this.undoEntries = this.undoEntries.filter(predicate)
    this.redoEntries = this.redoEntries.filter(predicate)
  }
}
