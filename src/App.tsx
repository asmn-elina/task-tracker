import { useEffect, useMemo, useState } from 'react'
import './App.css'

type ColumnId = 'backlog' | 'in-progress' | 'done'

type Priority = 'low' | 'medium' | 'high'

interface Task {
  id: string
  title: string
  description: string
  priority: Priority
  deadline: string
  column: ColumnId
  createdAt: number
}

const COLUMN_CONFIG: { id: ColumnId; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

const STORAGE_KEY = 'kanban_tasks_v1'

function loadTasks(): Task[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Task[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveTasks(tasks: Task[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    // ignore storage errors
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [deadline, setDeadline] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  const tasksByColumn = useMemo(
    () =>
      COLUMN_CONFIG.reduce(
        (acc, col) => ({
          ...acc,
          [col.id]: tasks
            .filter((t) => t.column === col.id)
            .sort((a, b) => a.createdAt - b.createdAt),
        }),
        {} as Record<ColumnId, Task[]>,
      ),
    [tasks],
  )

  function resetForm() {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setDeadline('')
    setEditingId(null)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return

    if (editingId) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === editingId
            ? {
                ...task,
                title: title.trim(),
                description: description.trim(),
                priority,
                deadline,
              }
            : task,
        ),
      )
      resetForm()
      setIsFormOpen(false)
      return
    }

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      priority,
      deadline,
      column: 'backlog',
      createdAt: Date.now(),
    }

    setTasks((prev) => [...prev, newTask])
    resetForm()
    setIsFormOpen(false)
  }

  function handleDeleteCurrent() {
    if (!editingId) return
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
    setIsFormOpen(true)
  }

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

  function handleDrop(event: React.DragEvent<HTMLElement>, column: ColumnId) {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain')
    if (!id) return

    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, column } : task)),
    )
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
