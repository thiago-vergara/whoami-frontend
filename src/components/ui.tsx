import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Check, ExternalLink, LockKeyhole } from 'lucide-react'
import { ApiError } from '../lib/api'
import { errorText, initials, isHttps } from '../lib/format'
import { rememberReturn } from '../lib/auth'
import type { EventStatus, Wish } from '../lib/types'

export function Button({
  children,
  pending,
  variant = 'primary',
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean
  variant?: 'primary' | 'secondary' | 'quiet'
}) {
  return (
    <button
      {...props}
      className={`button ${variant} ${className}`}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending && <span className="working" aria-hidden="true" />}
      {children}
    </button>
  )
}
export function Avatar({
  name,
  url,
  large = false,
}: {
  name: string
  url?: string | null
  large?: boolean
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  return (
    <span className={`avatar ${large ? 'large' : ''}`} aria-hidden="true">
      {url && url !== failedUrl ? (
        <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
      ) : (
        initials(name)
      )}
    </span>
  )
}
export function Status({ status }: { status: EventStatus }) {
  const labels = { OPEN: 'Abierto', DRAWN: 'Sorteado', CANCELLED: 'Cancelado' }
  return (
    <span className={`status ${status.toLowerCase()}`}>
      <span aria-hidden="true">{status === 'DRAWN' ? '✓' : status === 'OPEN' ? '●' : '—'}</span>
      {labels[status]}
    </span>
  )
}
export function Notice({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return (
    <div className={`notice ${success ? 'success' : ''}`} role={success ? 'status' : 'note'}>
      {success ? (
        <Check size={19} aria-hidden="true" />
      ) : (
        <LockKeyhole size={19} aria-hidden="true" />
      )}
      <div>{children}</div>
    </div>
  )
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  const location = useLocation()
  if (!error) return null
  const expired = error instanceof ApiError && error.status === 401
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={20} aria-hidden="true" />
      <div>
        <p>{errorText(error)}</p>
        {expired ? (
          <Link to="/login" onClick={() => rememberReturn(location.pathname)}>
            Entrar de nuevo <ArrowRight size={16} />
          </Link>
        ) : (
          retry && (
            <button type="button" className="text-button" onClick={retry}>
              Intentar de nuevo
            </button>
          )
        )}
      </div>
    </div>
  )
}
export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <p>{label}</p>
      <div className="skeleton" />
      <div className="skeleton short" />
      <div className="skeleton" />
    </div>
  )
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <EnvelopeArt small />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}
export function PageHeading({
  eyebrow,
  title,
  children,
  action,
  back,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
  action?: ReactNode
  back?: string
}) {
  return (
    <div className="page-heading">
      {back && (
        <Link className="back-link" to={back}>
          <ArrowLeft size={17} /> Volver
        </Link>
      )}
      <div className="heading-row">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 tabIndex={-1}>{title}</h1>
          {children && <p className="intro">{children}</p>}
        </div>
        {action && <div className="heading-action">{action}</div>}
      </div>
    </div>
  )
}
export function Field({
  label,
  children,
  hint,
  error,
  required = false,
  className = '',
}: {
  label: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="required-label"> (obligatorio)</span>}
      </label>
      {children({
        id,
        'aria-describedby': error || hint ? `${id}-help` : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {(error || hint) && (
        <p id={`${id}-help`} className={error ? 'field-error' : 'field-hint'}>
          {error || hint}
        </p>
      )}
    </div>
  )
}
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pending,
  confirmDisabled,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  pending?: boolean
  confirmDisabled?: boolean
  error?: unknown
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const bodyId = useId()
  useEffect(() => {
    if (open) {
      dialog.current?.showModal()
      cancel.current?.focus()
    } else dialog.current?.close()
  }, [open])
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(e) => {
        e.preventDefault()
        if (!pending) onCancel()
      }}
    >
      <div className="dialog-content">
        <span className="eyebrow">Antes de continuar</span>
        <h2 id={titleId}>{title}</h2>
        <div id={bodyId} className="dialog-description">
          {children}
        </div>
        <ErrorNotice error={error} />
        <div className="dialog-actions">
          <button
            ref={cancel}
            type="button"
            className="button secondary"
            onClick={onCancel}
            disabled={pending}
          >
            Volver
          </button>
          <Button pending={pending} disabled={confirmDisabled} onClick={onConfirm}>
            {pending ? 'Procesando…' : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
export function Pagination({
  page,
  hasNext,
  pending,
  onChange,
}: {
  page: number
  hasNext: boolean
  pending?: boolean
  onChange: (page: number) => void
}) {
  if (!page && !hasNext) return null
  return (
    <nav className="pagination" aria-label="Páginas">
      <Button variant="secondary" disabled={!page || pending} onClick={() => onChange(page - 1)}>
        <ArrowLeft size={16} /> Anterior
      </Button>
      <span className="mono">Página {page + 1}</span>
      <Button variant="secondary" disabled={!hasNext || pending} onClick={() => onChange(page + 1)}>
        Siguiente <ArrowRight size={16} />
      </Button>
    </nav>
  )
}
export function WishList({
  wishes,
  onDelete,
  disabled,
}: {
  wishes: Wish[]
  onDelete?: (wish: Wish) => void
  disabled?: boolean
}) {
  return (
    <ul className="wish-list">
      {wishes.map((wish, index) => (
        <li key={wish.id}>
          <span className="wish-number mono" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="grow">
            <h3>{wish.title}</h3>
            {wish.referencePlace && <p className="preserve-lines">{wish.referencePlace}</p>}
            {wish.referenceUrl && isHttps(wish.referenceUrl) && (
              <a
                className="external"
                href={wish.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                Ver referencia <ExternalLink size={14} />
                <span className="sr-only"> (nueva pestaña)</span>
              </a>
            )}
          </div>
          {onDelete && (
            <Button
              variant="quiet"
              disabled={disabled}
              onClick={() => onDelete(wish)}
              aria-label={`Eliminar ${wish.title}`}
            >
              Eliminar
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
export function EnvelopeArt({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={`envelope-art ${small ? 'small' : ''}`}
      viewBox="0 0 360 300"
      fill="none"
      aria-hidden="true"
    >
      <path d="M61 97 180 35 299 97v147H61Z" fill="#EEF5F1" stroke="#2C6E59" strokeWidth="2" />
      <path d="M100 69h160v155H100z" fill="white" stroke="#D4D4D8" strokeWidth="2" />
      <path
        d="M128 112h104m-104 18h104m-104 18h68"
        stroke="#D4D4D8"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="m61 97 119 103L299 97v147H61Z"
        fill="#FAFAFA"
        stroke="#2C6E59"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="m61 244 90-72m148 72-90-72" stroke="#2C6E59" strokeWidth="2" />
      <path d="M167 175h26v79l-13-9-13 9z" fill="#2C6E59" />
      <circle cx="180" cy="192" r="13" fill="#2C6E59" stroke="#FAFAFA" strokeWidth="4" />
      <path
        d="m40 63 7-9m265 180 9 4m-21-191 9-4"
        stroke="#2C6E59"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
