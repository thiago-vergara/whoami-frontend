import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { Button, ErrorNotice, Field, Loading } from './ui'
import { AVATAR_SIZE, drawCrop, exportCrop, loadCropImage } from '../lib/avatar-crop'

export default function AvatarCropDialog({
  file,
  onCancel,
  onSave,
}: {
  file: File
  onCancel: () => void
  onSave: (file: File) => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const title = useId()
  const description = useId()
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadCropImage>> | null>(null)
  const [zoom, setZoom] = useState(1)
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  useEffect(() => {
    dialog.current?.showModal()
    let active = true
    let url: string | undefined
    loadCropImage(file)
      .then((value) => {
        url = value.url
        if (active) setLoaded(value)
        else URL.revokeObjectURL(value.url)
      })
      .catch((e) => {
        if (active) setError(e)
      })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])
  useEffect(() => {
    if (!loaded || !canvas.current) return
    try {
      drawCrop(canvas.current, loaded.image, zoom, x, y)
    } catch (e) {
      setError(e)
    }
  }, [loaded, zoom, x, y])
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || saving) return
    const width = e.currentTarget.getBoundingClientRect().width
    setX(
      Math.max(
        -100,
        Math.min(100, drag.current.left - ((e.clientX - drag.current.x) / width) * 200),
      ),
    )
    setY(
      Math.max(
        -100,
        Math.min(100, drag.current.top - ((e.clientY - drag.current.y) / width) * 200),
      ),
    )
  }
  return (
    <dialog
      ref={dialog}
      className="crop-dialog"
      aria-labelledby={title}
      aria-describedby={description}
      onCancel={(e) => {
        e.preventDefault()
        if (!saving) onCancel()
      }}
    >
      <div className="dialog-content">
        <p className="eyebrow">TU FOTO DE PERFIL</p>
        <h2 id={title}>Encuentra tu mejor encuadre.</h2>
        <p id={description}>
          Recorte cuadrado de {AVATAR_SIZE} × {AVATAR_SIZE} px. Arrastra la foto o usa los controles
          para ajustar el encuadre.
        </p>
        {!loaded && !error && <Loading label="Preparando la imagen…" />}
        {loaded && (
          <>
            <div className="crop-preview">
              <canvas
                ref={canvas}
                width={AVATAR_SIZE}
                height={AVATAR_SIZE}
                role="img"
                aria-label="Vista previa del recorte cuadrado de la foto de perfil"
                onPointerDown={(e) => {
                  if (saving) return
                  e.currentTarget.setPointerCapture(e.pointerId)
                  drag.current = { x: e.clientX, y: e.clientY, left: x, top: y }
                }}
                onPointerMove={move}
                onPointerUp={() => {
                  drag.current = null
                }}
                onPointerCancel={() => {
                  drag.current = null
                }}
              />
            </div>
            <fieldset disabled={saving} className="crop-controls">
              <Field label="Acercamiento">
                {(p) => (
                  <input
                    {...p}
                    type="range"
                    min="1"
                    max="4"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />
                )}
              </Field>
              <Field label="Posición horizontal">
                {(p) => (
                  <input
                    {...p}
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={x}
                    onChange={(e) => setX(Number(e.target.value))}
                  />
                )}
              </Field>
              <Field label="Posición vertical">
                {(p) => (
                  <input
                    {...p}
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={y}
                    onChange={(e) => setY(Number(e.target.value))}
                  />
                )}
              </Field>
            </fieldset>
          </>
        )}
        <ErrorNotice error={error} />
        <div className="dialog-actions">
          <Button variant="secondary" disabled={saving} onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={!loaded}
            pending={saving}
            onClick={async () => {
              if (!canvas.current || saving || !loaded) return
              setSaving(true)
              setError(null)
              try {
                drawCrop(canvas.current, loaded.image, zoom, x, y)
                await onSave(await exportCrop(canvas.current))
              } catch (e) {
                setError(e)
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Guardando foto…' : 'Guardar recorte'}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
