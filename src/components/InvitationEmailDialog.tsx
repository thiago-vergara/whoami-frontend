import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Send } from 'lucide-react'
import { api } from '../lib/api'
import { Button, ErrorNotice, Field } from './ui'

export default function InvitationEmailDialog({
  eventId,
  eventTitle,
  userId,
  onClose,
  onQueued,
}: {
  eventId: string
  eventTitle: string
  userId: string
  onClose: () => void
  onQueued: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const title = useId(),
    description = useId()
  const [email, setEmail] = useState('')
  const request = useRef<{ email: string; id: string } | null>(null)
  const cache = useQueryClient()
  const send = useMutation({
    mutationFn: () => {
      const address = email.trim().toLowerCase()
      if (request.current?.email !== address)
        request.current = { email: address, id: crypto.randomUUID() }
      return api.sendInvitation(eventId, address, request.current.id)
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: [userId, 'notifications', eventId] })
      onQueued()
    },
  })
  useEffect(() => {
    const previous = document.activeElement
    const modal = dialog.current
    modal?.showModal()
    input.current?.focus()
    return () => {
      modal?.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!send.isPending) send.mutate()
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby={title}
      aria-describedby={description}
      onCancel={(event) => {
        event.preventDefault()
        if (!send.isPending) onClose()
      }}
    >
      <form onSubmit={submit} className="dialog-content invitation-email-form">
        <span className="email-dialog-icon">
          <Mail size={23} />
        </span>
        <p className="eyebrow">UN LUGAR EN TU GRUPO</p>
        <h2 id={title}>Manda una invitación.</h2>
        <p id={description}>
          Le enviaremos una invitación a <strong>{eventTitle}</strong>, con el enlace para
          registrarse o iniciar sesión y unirse.
        </p>
        <Field label="Correo de la persona invitada" required>
          {(p) => (
            <input
              {...p}
              ref={input}
              required
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={send.isPending}
              placeholder="amiga@correo.com"
            />
          )}
        </Field>
        <ErrorNotice error={send.error} />
        <p className="caption">
          Envía la invitación solo a alguien que esperas en tu grupo. Hasta 20 por hora; espera 5
          minutos para repetir una dirección.
        </p>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button type="submit" pending={send.isPending}>
            <Send size={17} />
            {send.isPending ? 'Programando envío…' : 'Enviar invitación'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
