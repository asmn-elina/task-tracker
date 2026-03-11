import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { supabase } from './supabase'

type ColumnId = 'backlog' | 'in-progress' | 'done'

type Priority = 'low' | 'medium' | 'high'

type TagId = string

interface Tag {
  id: TagId
  name: string
  color: string
}

interface Task {
  id: string
  title: string
  description: string
  priority: Priority
  deadline: string
  column: ColumnId
  createdAt: number
  tags: TagId[]
}

type SupabaseTaskRow = {
  id: string
  title: string | null
  description: string | null
  status: string | null
  priority: string | null
  deadline: string | null
  created_at: string | null
  tags: string | null
}

const COLUMN_CONFIG: { id: ColumnId; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

function getRandomColorFromString(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 70% 80%)`
}

function parseTagsFromText(value: string | null): TagId[] {
  if (!value) return []
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function stringifyTagsToText(tags: TagId[]): string {
  if (!tags.length) return ''
  return tags.join(',')
}

function mapRowToTask(row: SupabaseTaskRow): Task {
  const column =
    (row.status as ColumnId | null) && ['backlog', 'in-progress', 'done'].includes(row.status ?? '')
      ? (row.status as ColumnId)
      : 'backlog'

  const priority =
    (row.priority as Priority | null) && ['low', 'medium', 'high'].includes(row.priority ?? '')
      ? (row.priority as Priority)
      : 'medium'

  return {
    id: row.id,
    title: row.title ?? '',
    description: row.description ?? '',
    priority,
    deadline: row.deadline ? row.deadline.slice(0, 10) : '',
    column,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    tags: parseTagsFromText(row.tags),
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [deadline, setDeadline] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<TagId[]>([])
  const [filterTagIds, setFilterTagIds] = useState<TagId[]>([])
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadFromSupabase() {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load tasks from Supabase', error)
        return
      }

      const rows = (data ?? []) as SupabaseTaskRow[]
      const loadedTasks = rows.map(mapRowToTask)
      setTasks(loadedTasks)
    }

    loadFromSupabase()
  }, [])

  useEffect(() => {
    const usedTagIds = new Set<TagId>()
    tasks.forEach((task) => {
      task.tags?.forEach((id) => {
        usedTagIds.add(id)
      })
    })

    const nextTags: Tag[] = Array.from(usedTagIds).map((id) => ({
      id,
      name: id,
      color: getRandomColorFromString(id),
    }))

    setTags((prev) => {
      if (prev.length === nextTags.length) {
        const same = prev.every((tag) =>
          nextTags.some((next) => next.id === tag.id && next.color === tag.color),
        )
        if (same) return prev
      }
      return nextTags
    })

    setFilterTagIds((prev) => prev.filter((id) => usedTagIds.has(id)))
  }, [tasks])

  const tasksForBoard = useMemo(() => {
    if (!filterTagIds.length) return tasks
    return tasks.filter((task) =>
      filterTagIds.every((tagId) => task.tags.includes(tagId)),
    )
  }, [tasks, filterTagIds])

  const tasksByColumn = useMemo(
    () =>
      COLUMN_CONFIG.reduce(
        (acc, col) => {
          const columnTasks = tasksForBoard
            .filter((t) => t.column === col.id)
            .sort((a, b) => a.createdAt - b.createdAt)
          return {
            ...acc,
            [col.id]: columnTasks,
          }
        },
        {} as Record<ColumnId, Task[]>,
      ),
    [tasksForBoard],
  )

  function resetForm() {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setDeadline('')
    setTagInput('')
    setSelectedTagIds([])
    setIsTagDropdownOpen(false)
    setEditingId(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return

    if (editingId) {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          description: description.trim(),
          priority,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          tags: stringifyTagsToText(selectedTagIds),
        })
        .eq('id', editingId)

      if (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to update task', error)
        return
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === editingId
            ? {
                ...task,
                title: title.trim(),
                description: description.trim(),
                priority,
                deadline,
                tags: selectedTagIds,
              }
            : task,
        ),
      )
      resetForm()
      setIsFormOpen(false)
      return
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: title.trim(),
        description: description.trim(),
        priority,
        status: 'backlog',
        deadline: deadline ? new Date(deadline).toISOString() : null,
        tags: stringifyTagsToText(selectedTagIds),
      })
      .select('*')
      .single()

    if (error || !data) {
      // eslint-disable-next-line no-console
      console.error('Failed to create task', error)
      return
    }

    const created = mapRowToTask(data as SupabaseTaskRow)
    setTasks((prev) => [...prev, created])
    resetForm()
    setIsFormOpen(false)
  }

  async function handleDeleteCurrent() {
    if (!editingId) return

    const { error } = await supabase.from('tasks').delete().eq('id', editingId)

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete task', error)
      return
    }

    setTasks((prev) => prev.filter((task) => task.id !== editingId))
    resetForm()
    setIsFormOpen(false)
  }

  function startEditing(task: Task) {
    setEditingId(task.id)
    setTitle(task.title)
    setDescription(task.description)
    setPriority(task.priority)
    setDeadline(task.deadline)
    setSelectedTagIds(task.tags ?? [])
    setIsFormOpen(true)
  }

  function handleAddTagByName(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const existing = tags.find(
      (tag) => tag.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (existing) {
      setSelectedTagIds((prev) =>
        prev.includes(existing.id) ? prev : [...prev, existing.id],
      )
      return
    }
    const newTag: Tag = {
      id: trimmed,
      name: trimmed,
      color: getRandomColorFromString(trimmed),
    }
    setTags((prev) => [...prev, newTag])
    setSelectedTagIds((prev) => [...prev, newTag.id])
  }

  function handleTagInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (!tagInput.trim()) return
      handleAddTagByName(tagInput)
      setTagInput('')
      setIsTagDropdownOpen(false)
    }
  }

  function toggleTagSelection(id: TagId) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  function toggleFilterTag(id: TagId) {
    setFilterTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  const selectedTags = useMemo(
    () => tags.filter((tag) => selectedTagIds.includes(tag.id)),
    [tags, selectedTagIds],
  )

  const hasActiveFilters = filterTagIds.length > 0

  function handleCreateButtonClick() {
    resetForm()
    setIsFormOpen(true)
  }

  function handleDragStart(event: React.DragEvent<HTMLElement>, id: string) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
    setDraggingId(id)
  }

  function handleDragEnd() {
    setDraggingId(null)
  }

  async function handleDrop(event: React.DragEvent<HTMLElement>, column: ColumnId) {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain')
    if (!id) return

    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, column } : task)),
    )

    const { error } = await supabase
      .from('tasks')
      .update({ status: column })
      .eq('id', id)

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to move task', error)
    }
    setDraggingId(null)
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function priorityLabel(value: Priority) {
    switch (value) {
      case 'low':
        return 'Low'
      case 'high':
        return 'High'
      default:
        return 'Medium'
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-title">Task Tracker</h1>
          <p className="app-subtitle">Minimal Kanban board</p>
        </div>
      </header>

      {!isFormOpen && (
        <div className="task-form-trigger-row">
          <button
            type="button"
            className="primary-button task-form-trigger-button"
            onClick={handleCreateButtonClick}
          >
            + Create task
          </button>
        </div>
      )}

      {!!tags.length && (
        <div className="tag-filter-row">
          <span className="tag-filter-label">Filter by tags:</span>
          <div className="tag-filter-list">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`tag-filter-chip ${
                  filterTagIds.includes(tag.id) ? 'tag-filter-chip-active' : ''
                }`}
                style={{ backgroundColor: tag.color }}
                onClick={() => toggleFilterTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
            {hasActiveFilters && (
              <button
                type="button"
                className="tag-filter-clear"
                onClick={() => setFilterTagIds([])}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {isFormOpen && (
        <section className="task-form-section">
          <form className="task-form" onSubmit={handleSubmit}>
            <div className="task-form-header">
              <button
                type="button"
                className="icon-button"
                aria-label="Collapse task form"
                onClick={() => {
                  resetForm()
                  setIsFormOpen(false)
                }}
              >
                ✕
              </button>
              <span className="task-form-title">
                {editingId ? 'Edit task' : 'New task'}
              </span>
            </div>

            <div className="task-form-row">
              <label className="task-label">
                <span>Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short task title"
                  required
                />
              </label>
            </div>

            <div className="task-form-row">
              <label className="task-label">
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What needs to be done?"
                  rows={3}
                />
              </label>
            </div>

            <div className="task-form-row task-form-row-inline">
              <label className="task-label">
                <span>Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label className="task-label">
                <span>Deadline</span>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </label>
            </div>

            <div className="task-form-row">
              <label className="task-label">
                <span>Tags</span>
                <div className="tag-input-wrapper">
                  <div className="tag-selected-list">
                    {selectedTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className="tag-chip"
                        style={{ backgroundColor: tag.color }}
                        onClick={() => toggleTagSelection(tag.id)}
                      >
                        {tag.name}
                      </button>
                    ))}
                    {!selectedTags.length && (
                      <span className="tag-placeholder">
                        Add or select tags
                      </span>
                    )}
                  </div>
                  <div className="tag-input-row">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder="Type tag and press Enter"
                      onFocus={() => setIsTagDropdownOpen(true)}
                    />
                    <button
                      type="button"
                      className="secondary-button tag-dropdown-toggle"
                      onClick={() =>
                        setIsTagDropdownOpen((prev) => !prev)
                      }
                    >
                      ▼
                    </button>
                  </div>
                  {isTagDropdownOpen && !!tags.length && (
                    <div className="tag-dropdown">
                      {tags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          className={`tag-dropdown-item ${
                            selectedTagIds.includes(tag.id)
                              ? 'tag-dropdown-item-selected'
                              : ''
                          }`}
                          style={{ backgroundColor: tag.color }}
                          onClick={() => toggleTagSelection(tag.id)}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="task-form-actions">
              {editingId && (
                <>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={handleDeleteCurrent}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      resetForm()
                      setIsFormOpen(false)
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
              <button type="submit" className="primary-button">
                {editingId ? 'Save changes' : 'Create task'}
              </button>
            </div>
          </form>
        </section>
      )}

      <main className="board">
        {COLUMN_CONFIG.map((column) => (
          <section
            key={column.id}
            className="column"
            onDrop={(event) => handleDrop(event, column.id)}
            onDragOver={handleDragOver}
          >
            <header className="column-header">
              <h2>{column.title}</h2>
              <span className="column-count">
                {tasksByColumn[column.id]?.length ?? 0}
              </span>
            </header>
            <div className="column-body">
              {tasksByColumn[column.id]?.length ? (
                tasksByColumn[column.id].map((task) => (
                  <article
                    key={task.id}
                    className={`task-card ${
                      draggingId === task.id ? 'task-card-dragging' : ''
                    } ${editingId === task.id ? 'task-card-editing' : ''}`}
                    draggable
                    onDragStart={(event) => handleDragStart(event, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => startEditing(task)}
                  >
                    <header className="task-card-header">
                      <h3 className="task-title">{task.title}</h3>
                      <span className={`priority-badge priority-${task.priority}`}>
                        {priorityLabel(task.priority)}
                      </span>
                    </header>
                    {task.description && (
                      <p className="task-description">{task.description}</p>
                    )}
                    <footer className="task-card-footer">
                      {task.deadline && (
                        <span className="task-deadline">
                          Due: {task.deadline}
                        </span>
                      )}
                      {!!task.tags?.length && (
                        <div className="task-tags">
                          {task.tags
                            .map((tagId) => tags.find((tag) => tag.id === tagId))
                            .filter(Boolean)
                            .map((tag) => (
                              <span
                                key={tag!.id}
                                className="task-tag-chip"
                                style={{ backgroundColor: tag!.color }}
                              >
                                {tag!.name}
                              </span>
                            ))}
                        </div>
                      )}
                    </footer>
                  </article>
                ))
              ) : (
                <p className="column-empty">Drop tasks here</p>
              )}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

export default App