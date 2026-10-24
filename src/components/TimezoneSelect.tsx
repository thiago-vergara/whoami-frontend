import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'

const zones = [
  ['America/Lima', 'Hora de Lima (UTC−5)'],
  ['America/Bogota', 'Bogotá'],
  ['America/Mexico_City', 'Ciudad de México'],
  ['America/Santiago', 'Santiago de Chile'],
  ['America/Argentina/Buenos_Aires', 'Buenos Aires'],
  ['Europe/Madrid', 'Madrid'],
]

export default function TimezoneSelect({
  value,
  onChange,
  id,
  ...aria
}: {
  value: string
  onChange: (value: string) => void
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}) {
  const options = zones.some(([zone]) => zone === value) ? zones : [...zones, [value, value]]
  const selected = options.findIndex(([zone]) => zone === value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(selected)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, id])
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const focus = (event: FocusEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('focusin', focus)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('focusin', focus)
    }
  }, [open])
  function choose(index: number) {
    onChange(options[index][0])
    setOpen(false)
    trigger.current?.focus()
  }
  function keys(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'Tab') {
      setOpen(false)
      return
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      setOpen(true)
      setActive(
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? options.length - 1
            : Math.max(
                0,
                Math.min(
                  options.length - 1,
                  (open ? active : selected) + (event.key === 'ArrowDown' ? 1 : -1),
                ),
              ),
      )
    } else if (open && ['Enter', ' '].includes(event.key)) {
      event.preventDefault()
      choose(active)
    }
  }
  return (
    <div ref={root} className="timezone-select">
      <button
        {...aria}
        id={id}
        type="button"
        ref={trigger}
        className="timezone-trigger"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        onKeyDown={keys}
        onClick={() => {
          setActive(selected)
          setOpen(!open)
        }}
      >
        <span>{options[selected]?.[1] || value}</span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <ul
          id={`${id}-options`}
          role="listbox"
          aria-label="Zona horaria"
          className="timezone-options"
        >
          {options.map(([zone, label], index) => (
            <li
              id={`${id}-option-${index}`}
              key={zone}
              role="option"
              aria-selected={zone === value}
              className={index === active ? 'highlighted' : ''}
              onPointerMove={() => setActive(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{label}</span>
              {zone === value && <Check size={16} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
