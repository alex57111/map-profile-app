import { useRef, useState } from 'react'
interface Pos { x: number; y: number }
export function useDraggable(initial: Pos = { x: 0, y: 0 }) {
  const [pos, setPos] = useState<Pos>(initial)
  const dragging = useRef(false)
  const startPos = useRef<Pos>({ x: 0, y: 0 })
  const startMouse = useRef<Pos>({ x: 0, y: 0 })
  const didMove = useRef(false)
  const startTime = useRef(0)
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true; didMove.current = false; startTime.current = Date.now()
    startPos.current = pos; startMouse.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - startMouse.current.x; const dy = e.clientY - startMouse.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didMove.current = true
    setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy })
  }
  const onPointerUp = () => { dragging.current = false }
  const wasTap = () => !didMove.current || Date.now() - startTime.current < 200
  return { pos, onPointerDown, onPointerMove, onPointerUp, wasTap }
}
