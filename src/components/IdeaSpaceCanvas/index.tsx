import Taro from '@tarojs/taro'
import { Canvas } from '@tarojs/components'
import { useEffect, useRef } from 'react'
import { getIdeaTitle } from '@/utils/ideaText'
import type { Idea, PriorityKey } from '@/types/idea'
import { useTheme } from '@/theme'
import './index.css'

const CANVAS_ID = 'idea-space-canvas'
const NON_INBOX_PRIORITIES: PriorityKey[] = ['urgent', 'important', 'quick']

type CanvasLike = any
type Context2D = any

interface CanvasRect {
  left: number
  top: number
  width: number
  height: number
}

interface DockRect {
  left: number
  right: number
  top: number
  bottom: number
  priority: PriorityKey
}

interface Point {
  x: number
  y: number
}

interface NodeState {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  base: number
}

interface GestureState {
  start: Point
  hitId: string | null
  pan: boolean
  cameraStart: Point
  nodeStart?: Point
}

interface Props {
  ideas: Idea[]
  active: boolean
  onOpenIdea: (id: string) => void
  onAssignPriority: (id: string, priority: PriorityKey) => void
  onDragUiChange: (active: boolean, hover: PriorityKey | null) => void
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const normalized = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const n = Number.parseInt(normalized, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function roundedRectPath(ctx: Context2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export default function IdeaSpaceCanvas({ ideas, active, onOpenIdea, onAssignPriority, onDragUiChange }: Props) {
  const { theme } = useTheme()
  const canvasRef = useRef<CanvasLike>(null)
  const contextRef = useRef<Context2D>(null)
  const rectRef = useRef<CanvasRect>({ left: 0, top: 0, width: 375, height: 560 })
  const nodesRef = useRef<NodeState[]>([])
  const ideasRef = useRef(ideas)
  const activeRef = useRef(active)
  const cameraRef = useRef<Point>({ x: 0, y: 0 })
  const pointerRef = useRef<Point>({ x: -999, y: -999 })
  const gestureRef = useRef<GestureState | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const dockRectsRef = useRef<DockRect[]>([])
  const rafRef = useRef<number | null>(null)
  const h5CleanupRef = useRef<(() => void) | null>(null)
  const callbacksRef = useRef({ onOpenIdea, onAssignPriority, onDragUiChange })
  const themeRef = useRef(theme)

  useEffect(() => {
    ideasRef.current = ideas
    syncNodes()
  }, [ideas])

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    callbacksRef.current = { onOpenIdea, onAssignPriority, onDragUiChange }
  }, [onOpenIdea, onAssignPriority, onDragUiChange])

  const makeNode = (idea: Idea, index: number): NodeState => {
    const { width, height } = rectRef.current
    const angle = index * 2.399
    const radius = 45 + ((index * 43) % 130)
    return {
      id: idea.id,
      x: width * 0.5 + Math.cos(angle) * radius * 0.85,
      y: height * 0.46 + Math.sin(angle) * radius * 1.1,
      vx: (Math.random() - 0.5) * 0.09,
      vy: (Math.random() - 0.5) * 0.09,
      phase: Math.random() * Math.PI * 2,
      base: idea.pinned ? 8 : 6.4
    }
  }

  const syncNodes = () => {
    const ids = new Set(ideasRef.current.map((idea) => idea.id))
    nodesRef.current = nodesRef.current.filter((node) => ids.has(node.id))
    ideasRef.current.forEach((idea, index) => {
      if (!nodesRef.current.some((node) => node.id === idea.id)) {
        nodesRef.current.push(makeNode(idea, index))
      }
    })
  }

  const requestFrame = (callback: (time: number) => void): number => {
    const canvas = canvasRef.current
    if (canvas?.requestAnimationFrame) return canvas.requestAnimationFrame(callback)
    if (typeof window !== 'undefined' && window.requestAnimationFrame) return window.requestAnimationFrame(callback)
    return setTimeout(() => callback(Date.now()), 16) as unknown as number
  }

  const cancelFrame = (id: number) => {
    const canvas = canvasRef.current
    if (canvas?.cancelAnimationFrame) canvas.cancelAnimationFrame(id)
    else if (typeof window !== 'undefined' && window.cancelAnimationFrame) window.cancelAnimationFrame(id)
    else clearTimeout(id)
  }

  const draw = (time: number) => {
    rafRef.current = requestFrame(draw)
    if (!activeRef.current) return

    const ctx = contextRef.current
    if (!ctx) return
    const { width, height } = rectRef.current
    const camera = cameraRef.current
    const ideasMap = new Map(ideasRef.current.map((idea) => [idea.id, idea]))
    const currentTheme = themeRef.current

    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.translate(camera.x, camera.y)

    for (let a = 0; a < nodesRef.current.length; a += 1) {
      for (let b = a + 1; b < nodesRef.current.length; b += 1) {
        const A = nodesRef.current[a]
        const B = nodesRef.current[b]
        const dx = A.x - B.x
        const dy = A.y - B.y
        const distance = Math.hypot(dx, dy)
        if (distance < 112) {
          ctx.strokeStyle = `rgba(${currentTheme.canvas.linkRgb},${(1 - distance / 112) * 0.11})`
          ctx.lineWidth = 0.7
          ctx.beginPath()
          ctx.moveTo(A.x, A.y)
          ctx.lineTo(B.x, B.y)
          ctx.stroke()
        }
      }
    }

    for (const node of nodesRef.current) {
      const idea = ideasMap.get(node.id)
      if (!idea) continue
      const dragging = dragIdRef.current === node.id
      const ideaColor = currentTheme.ideaPalette[idea.colorSlot]

      if (!dragging) {
        node.phase += 0.012
        node.vx += Math.sin(node.phase * 0.7) * 0.00075
        node.vy += Math.cos(node.phase * 0.6) * 0.00072
        node.vx *= 0.991
        node.vy *= 0.991
        node.x += node.vx
        node.y += node.vy
        if (node.x < 28 || node.x > width - 28) node.vx *= -1
        if (node.y < 30 || node.y > height - 65) node.vy *= -1
        node.x = Math.max(28, Math.min(width - 28, node.x))
        node.y = Math.max(30, Math.min(height - 65, node.y))
      }

      const px = pointerRef.current.x - camera.x
      const py = pointerRef.current.y - camera.y
      const near = Math.hypot(px - node.x, py - node.y) < 34
      const pulse = Math.sin(time * 0.002 + node.phase) * 0.75
      const radius = node.base + pulse + (near ? 2 : 0) + (dragging ? 4 : 0)

      const glow = ctx.createRadialGradient(node.x, node.y, 1, node.x, node.y, radius * 4.2)
      glow.addColorStop(0, hexToRgba(ideaColor, 0.5))
      glow.addColorStop(0.25, hexToRgba(ideaColor, 0.2))
      glow.addColorStop(1, hexToRgba(ideaColor, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius * 4.2, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = ideaColor
      ctx.globalAlpha = 0.96
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1

      if (idea.priority !== 'inbox') {
        ctx.strokeStyle = currentTheme.priorities[idea.priority]
        ctx.lineWidth = 1.8
        ctx.globalAlpha = 0.85
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      if (near || dragging) {
        const title = getIdeaTitle(idea.text)
        const text = title.length > 16 ? `${title.slice(0, 16)}…` : title
        ctx.font = '11px sans-serif'
        const textWidth = ctx.measureText(text).width
        const bx = Math.max(10, Math.min(width - textWidth - 28, node.x - textWidth / 2 - 10))
        const by = node.y - 38
        roundedRectPath(ctx, bx, by, textWidth + 20, 27, 9)
        ctx.fillStyle = currentTheme.canvas.tooltipBackground
        ctx.fill()
        ctx.strokeStyle = currentTheme.canvas.tooltipBorder
        ctx.stroke()
        ctx.fillStyle = currentTheme.canvas.tooltipText
        ctx.fillText(text, bx + 10, by + 18)
      }
    }

    ctx.restore()
  }

  /** H5 上 Taro Canvas 渲染为 taro-canvas-core，真正的 <canvas> 在其子节点里 */
  const resolveH5Canvas = (hostOrCanvas: Element | null): HTMLCanvasElement | null => {
    if (!hostOrCanvas) return null
    if (typeof (hostOrCanvas as HTMLCanvasElement).getContext === 'function') {
      return hostOrCanvas as HTMLCanvasElement
    }
    const nested = hostOrCanvas.querySelector?.('canvas') as HTMLCanvasElement | null
    if (nested && typeof nested.getContext === 'function') return nested
    const shadow = (hostOrCanvas as HTMLElement).shadowRoot?.querySelector('canvas') as HTMLCanvasElement | null
    if (shadow && typeof shadow.getContext === 'function') return shadow
    return null
  }

  const configureCanvas = (canvas: CanvasLike, rect: CanvasRect) => {
    if (!canvas || typeof canvas.getContext !== 'function') {
      console.warn('[IdeaSpaceCanvas] invalid canvas node, skip configure')
      return
    }
    const dpr = Math.min(2, Taro.getWindowInfo?.().pixelRatio || Taro.getSystemInfoSync().pixelRatio || 1)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.warn('[IdeaSpaceCanvas] getContext("2d") returned null')
      return
    }
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    if (typeof canvas.style !== 'undefined') {
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    else ctx.scale(dpr, dpr)
    canvasRef.current = canvas
    contextRef.current = ctx
    rectRef.current = { ...rect, width, height }
    syncNodes()
    if (rafRef.current !== null) cancelFrame(rafRef.current)
    rafRef.current = requestFrame(draw)
  }

  const measureCanvasForMiniProgram = () => {
    const query = Taro.createSelectorQuery()
    query.select(`#${CANVAS_ID}`).fields({ node: true, size: true })
    query.select(`#${CANVAS_ID}`).boundingClientRect()
    query.exec((result) => {
      const nodeResult = result?.[0] as any
      const rectResult = result?.[1] as any
      if (!nodeResult?.node || !rectResult) return
      configureCanvas(nodeResult.node, {
        left: rectResult.left || 0,
        top: rectResult.top || 0,
        width: rectResult.width || nodeResult.width || 375,
        height: rectResult.height || nodeResult.height || 560
      })
    })
  }

  const initH5Canvas = (attempt = 0) => {
    if (typeof document === 'undefined') return
    const host = document.getElementById(CANVAS_ID)
    const canvas = resolveH5Canvas(host)
    if (!canvas || !host) {
      if (attempt < 12) {
        setTimeout(() => initH5Canvas(attempt + 1), 50)
      }
      return
    }
    const rect = host.getBoundingClientRect()
    const width = rect.width || host.clientWidth || 375
    const height = rect.height || host.clientHeight || 560
    configureCanvas(canvas, {
      left: rect.left,
      top: rect.top,
      width,
      height
    })

    const pointerDown = (event: PointerEvent) => {
      event.preventDefault()
      beginPointer(event.clientX, event.clientY)
    }
    const pointerMove = (event: PointerEvent) => movePointer(event.clientX, event.clientY)
    const pointerUp = (event: PointerEvent) => endPointer(event.clientX, event.clientY)
    const pointerCancel = () => cancelPointer()
    const onResize = () => {
      const next = host.getBoundingClientRect()
      configureCanvas(canvas, {
        left: next.left,
        top: next.top,
        width: next.width || host.clientWidth || 375,
        height: next.height || host.clientHeight || 560
      })
    }

    canvas.style.touchAction = 'none'
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', pointerCancel)
    canvas.addEventListener('pointerleave', pointerCancel)
    window.addEventListener('resize', onResize)

    h5CleanupRef.current = () => {
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerCancel)
      canvas.removeEventListener('pointerleave', pointerCancel)
      window.removeEventListener('resize', onResize)
    }
  }

  const getLocalPoint = (clientX: number, clientY: number): Point => ({
    x: clientX - rectRef.current.left,
    y: clientY - rectRef.current.top
  })

  const hitNode = (x: number, y: number): NodeState | null => {
    const camera = cameraRef.current
    const px = x - camera.x
    const py = y - camera.y
    let best: NodeState | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const node of nodesRef.current) {
      const distance = Math.hypot(node.x - px, node.y - py)
      if (distance < 24 && distance < bestDistance) {
        best = node
        bestDistance = distance
      }
    }
    return best
  }

  const measureDock = () => {
    const query = Taro.createSelectorQuery()
    query.selectAll('.dock-action').boundingClientRect()
    query.exec((result) => {
      const rects = (result?.[0] || []) as any[]
      dockRectsRef.current = rects.slice(0, 3).map((rect, index) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        priority: NON_INBOX_PRIORITIES[index]
      }))
    })
  }

  const dockTarget = (clientX: number, clientY: number): PriorityKey | null => {
    const rect = dockRectsRef.current.find((item) => (
      clientX >= item.left && clientX <= item.right && clientY >= item.top && clientY <= item.bottom
    ))
    return rect?.priority || null
  }

  const beginPointer = (clientX: number, clientY: number) => {
    if (!activeRef.current) return
    const point = getLocalPoint(clientX, clientY)
    pointerRef.current = point
    const hit = hitNode(point.x, point.y)
    gestureRef.current = {
      start: point,
      hitId: hit?.id || null,
      pan: false,
      cameraStart: { ...cameraRef.current }
    }
  }

  const movePointer = (clientX: number, clientY: number) => {
    if (!activeRef.current) return
    const point = getLocalPoint(clientX, clientY)
    pointerRef.current = point
    const gesture = gestureRef.current
    if (!gesture) return

    const dx = point.x - gesture.start.x
    const dy = point.y - gesture.start.y
    const distance = Math.hypot(dx, dy)

    if (gesture.hitId) {
      if (!dragIdRef.current && distance > 7) {
        const node = nodesRef.current.find((item) => item.id === gesture.hitId)
        if (node) {
          dragIdRef.current = node.id
          gesture.nodeStart = { x: node.x, y: node.y }
          callbacksRef.current.onDragUiChange(true, null)
          setTimeout(() => { if (dragIdRef.current) measureDock() }, 32)
          setTimeout(() => { if (dragIdRef.current) measureDock() }, 240)
        }
      }

      if (dragIdRef.current) {
        const node = nodesRef.current.find((item) => item.id === dragIdRef.current)
        if (node) {
          node.x = point.x - cameraRef.current.x
          node.y = point.y - cameraRef.current.y
        }
        callbacksRef.current.onDragUiChange(true, dockTarget(clientX, clientY))
      }
    } else if (distance > 5) {
      gesture.pan = true
      cameraRef.current = {
        x: Math.max(-140, Math.min(140, gesture.cameraStart.x + dx)),
        y: Math.max(-120, Math.min(120, gesture.cameraStart.y + dy))
      }
    }
  }

  const endPointer = (clientX: number, clientY: number) => {
    const gesture = gestureRef.current
    if (!gesture) return

    if (dragIdRef.current) {
      const dragId = dragIdRef.current
      const target = dockTarget(clientX, clientY)
      if (target) callbacksRef.current.onAssignPriority(dragId, target)

      const node = nodesRef.current.find((item) => item.id === dragId)
      if (node && gesture.nodeStart) {
        node.x = gesture.nodeStart.x
        node.y = gesture.nodeStart.y
        node.vx = (Math.random() - 0.5) * 0.08
        node.vy = (Math.random() - 0.5) * 0.08
      }
      dragIdRef.current = null
      callbacksRef.current.onDragUiChange(false, null)
    } else if (gesture.hitId && !gesture.pan) {
      callbacksRef.current.onOpenIdea(gesture.hitId)
    }

    gestureRef.current = null
  }

  const cancelPointer = () => {
    dragIdRef.current = null
    gestureRef.current = null
    callbacksRef.current.onDragUiChange(false, null)
  }

  const touchClientPoint = (event: any, changed = false) => {
    const touches = changed ? event.changedTouches : event.touches
    const touch = touches?.[0] || event.changedTouches?.[0] || event.touches?.[0]
    if (!touch) return null
    return {
      x: touch.clientX ?? touch.pageX ?? 0,
      y: touch.clientY ?? touch.pageY ?? 0
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (process.env.TARO_ENV === 'h5') {
        initH5Canvas()
      } else {
        measureCanvasForMiniProgram()
      }
    }, 60)

    return () => {
      clearTimeout(timer)
      h5CleanupRef.current?.()
      h5CleanupRef.current = null
      if (rafRef.current !== null) cancelFrame(rafRef.current)
      rafRef.current = null
    }
    // Canvas lifecycle should initialize only once; dynamic data lives in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Canvas
      id={CANVAS_ID}
      type='2d'
      className='space-canvas'
      disableScroll
      onTouchStart={(event) => {
        if (process.env.TARO_ENV === 'h5') return
        const point = touchClientPoint(event)
        if (point) beginPointer(point.x, point.y)
      }}
      onTouchMove={(event) => {
        if (process.env.TARO_ENV === 'h5') return
        const point = touchClientPoint(event)
        if (point) movePointer(point.x, point.y)
      }}
      onTouchEnd={(event) => {
        if (process.env.TARO_ENV === 'h5') return
        const point = touchClientPoint(event, true)
        if (point) endPointer(point.x, point.y)
      }}
      onTouchCancel={() => {
        if (process.env.TARO_ENV !== 'h5') cancelPointer()
      }}
    />
  )
}
