import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, LockKeyhole, LogOut } from 'lucide-react'
import { useAuth } from '../auth-context'
import { api, ApiError } from '../lib/api'
import AvatarCropDialog from '../components/AvatarCropDialog'
import {
  Avatar,
  Button,
  ConfirmDialog,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  PageHeading,
} from '../components/ui'
import type { Profile } from '../lib/types'

export default function ProfilePage() {
  const { session } = useAuth()
  const profile = useQuery({
    queryKey: [session!.user.id, 'profile'],
    queryFn: ({ signal }) => api.profile(signal),
  })
  return (
    <div className="container">
      <PageHeading back="/eventos" eyebrow="AQUÍ EMPIEZA TODO" title="Un poco de ti.">
        Así te reconocerá tu grupo en cada encuentro.
      </PageHeading>
      {profile.error ? (
        <ErrorNotice error={profile.error} retry={() => profile.refetch()} />
      ) : profile.data ? (
        <ProfileForm key={profile.data.id} profile={profile.data} />
      ) : (
        <Loading label="Abriendo tu perfil…" />
      )}
    </div>
  )
}
function ProfileForm({ profile }: { profile: Profile }) {
  const { session, signOut, completeAccountDeletion } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(profile.fullName)
  const [phone, setPhone] = useState(profile.phone || '')
  const [message, setMessage] = useState('')
  const [validation, setValidation] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [logout, setLogout] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const key = [session!.user.id, 'profile']
  const save = useMutation({
    mutationFn: () => api.updateProfile({ fullName: name.trim(), phone: phone.trim() || null }),
    onSuccess: (updated) => {
      queryClient.setQueryData(key, updated)
      setName(updated.fullName)
      setPhone(updated.phone || '')
      setMessage('Tu perfil se guardó.')
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === profile.id && ['event', 'participants'].includes(String(q.queryKey[1])),
      })
    },
  })
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadAvatar(file),
    onSuccess: (updated) => {
      setCropFile(null)
      queryClient.setQueryData(key, updated)
      setMessage('Tu foto se actualizó. Los cambios de nombre y celular se guardan por separado.')
    },
  })
  const deletion = useMutation({
    mutationFn: () => api.deleteAccount(confirmation),
    onSuccess: () => {
      sessionStorage.setItem('whoami:account-deleted', '1')
      completeAccountDeletion()
      navigate('/login', { replace: true, state: { accountDeleted: true } })
    },
  })
  const exit = useMutation({
    mutationFn: signOut,
    onSuccess: () => navigate('/login', { replace: true }),
  })
  return (
    <div className="split-layout profile-layout">
      <section className="panel">
        <div className="profile-photo">
          <Avatar name={name || profile.fullName} url={profile.avatarUrl} large />
          <div>
            <h2>Tu foto, si te provoca.</h2>
            <p className="caption">PNG, JPEG o WebP · Hasta 10 MB · Recorte de 512 × 512 px</p>
            <Button
              variant="secondary"
              onClick={() => fileInput.current?.click()}
              pending={upload.isPending}
              disabled={save.isPending || deletion.isPending}
            >
              <Camera size={17} />
              {upload.isPending ? 'Subiendo foto…' : 'Cambiar foto'}
            </Button>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Seleccionar foto de perfil"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                setMessage('')
                upload.reset()
                if (file) setCropFile(file)
              }}
            />
          </div>
        </div>
        {upload.error instanceof ApiError && upload.error.status === 503 ? (
          <Notice>Las fotos no están disponibles ahora. Puedes guardar tus otros datos.</Notice>
        ) : (
          <ErrorNotice error={upload.error} />
        )}
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (save.isPending || upload.isPending) return
            setMessage('')
            setValidation(null)
            if (!name.trim()) {
              setValidation('Indica tu nombre completo.')
              return
            }
            if (phone.trim() && !/^\+[1-9][0-9]{6,14}$/.test(phone.trim())) {
              setValidation('Incluye el código de país, sin espacios. Por ejemplo: +51999888777.')
              return
            }
            save.mutate()
          }}
        >
          <Field
            label="Nombre completo"
            required
            hint="Este nombre se mostrará a las personas de tus eventos."
          >
            {(p) => (
              <input
                {...p}
                required
                maxLength={160}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Correo electrónico"
            hint="Tu correo pertenece a tu cuenta y no se puede editar desde aquí."
          >
            {(p) => <input {...p} type="email" value={profile.email} readOnly />}
          </Field>
          <Field
            label="Celular"
            hint="Opcional y privado. Incluye el código de país: +51999888777."
          >
            {(p) => (
              <input
                {...p}
                type="tel"
                autoComplete="tel"
                maxLength={16}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}
          </Field>
          {validation && (
            <p className="field-error" role="alert">
              {validation}
            </p>
          )}
          <ErrorNotice error={save.error} />
          {message && (
            <p role="status" className="success-message">
              {message}
            </p>
          )}
          <Button
            type="submit"
            pending={save.isPending}
            disabled={upload.isPending || deletion.isPending}
          >
            {save.isPending ? 'Guardando…' : 'Guardar mi perfil'}
          </Button>
        </form>
      </section>
      <aside className="paper-note">
        <LockKeyhole size={26} />
        <h2>
          Lo personal
          <br />
          se queda contigo.
        </h2>
        <p>
          Tu grupo y quien organiza pueden ver tu nombre completo. Tu correo y celular solo los
          puedes consultar tú.
        </p>
        <hr />
        <p>
          Al salir de tu cuenta, se limpian los datos privados de esta aplicación en el navegador.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            exit.reset()
            setLogout(true)
          }}
        >
          <LogOut size={17} /> Cerrar sesión
        </Button>
      </aside>
      <section className="panel account-deletion">
        <h2>Eliminar mi cuenta</h2>
        <p>
          Saldrás de los eventos abiertos y se cancelarán los abiertos que organizas. En los ya
          sorteados se conservará el historial sin tu nombre, foto ni deseos. Tu baja puede afectar
          al intercambio.
        </p>
        <Button
          variant="secondary"
          disabled={save.isPending || upload.isPending}
          onClick={() => {
            deletion.reset()
            setConfirmation('')
            setDeleting(true)
          }}
        >
          Eliminar mi cuenta
        </Button>
      </section>
      {cropFile && (
        <AvatarCropDialog
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={async (file) => {
            await upload.mutateAsync(file)
          }}
        />
      )}
      <ConfirmDialog
        open={deleting}
        title="¿Eliminar tu cuenta?"
        confirmLabel="Eliminar definitivamente"
        confirmDisabled={confirmation !== 'ELIMINAR'}
        pending={deletion.isPending}
        error={deletion.error}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          if (confirmation === 'ELIMINAR') deletion.mutate()
        }}
      >
        <p>
          Esta acción es irreversible. Se retirarán tus datos personales y se cerrará tu acceso. Los
          sorteos realizados se conservarán con una referencia anónima, sin volver a sortear.
        </p>
        <Field label="Escribe ELIMINAR para confirmar">
          {(p) => (
            <input
              {...p}
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={deletion.isPending}
            />
          )}
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={logout}
        title="¿Cerrar tu sesión?"
        confirmLabel="Cerrar sesión"
        pending={exit.isPending}
        error={exit.error}
        onCancel={() => setLogout(false)}
        onConfirm={() => exit.mutate()}
      >
        <p>Podrás volver a entrar con tu correo o Google.</p>
      </ConfirmDialog>
    </div>
  )
}
