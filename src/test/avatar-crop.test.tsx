import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AvatarCropDialog from '../components/AvatarCropDialog'
import { cropRegion, loadCropImage } from '../lib/avatar-crop'

afterEach(() => vi.restoreAllMocks())
describe('Recorte de avatar', () => {
  it('cubre el cuadrado sin espacios y limita zoom y desplazamiento', () => {
    expect(cropRegion(1200, 800, 1, 0, 0)).toEqual({ left: 200, top: 0, size: 800 })
    expect(cropRegion(1200, 800, 2, 100, -100)).toEqual({ left: 800, top: 0, size: 400 })
    expect(cropRegion(800, 1200, 100, -500, 500)).toEqual({ left: 0, top: 1000, size: 200 })
  })
  it('rechaza archivos inválidos antes de crear una URL', async () => {
    await expect(
      loadCropImage(new File(['svg'], 'bad.svg', { type: 'image/svg+xml' })),
    ).rejects.toThrow('PNG')
    await expect(loadCropImage(new File([], 'empty.jpg', { type: 'image/jpeg' }))).rejects.toThrow(
      '10 MB',
    )
  })
  it('previsualiza, exporta JPEG 512 y libera la imagen al cerrar', async () => {
    const drawImage = vi.fn(),
      revoke = vi.fn()
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 1200
        naturalHeight = 800
        src = ''
        decode = async () => {}
      },
    )
    URL.createObjectURL = vi.fn(() => 'blob:crop-test')
    URL.revokeObjectURL = revoke
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) {
      callback(new Blob(['jpeg'], { type: 'image/jpeg' }))
    })
    const save = vi.fn(async (_file: File) => {}),
      cancel = vi.fn(),
      user = userEvent.setup()
    const view = render(
      <MemoryRouter>
        <AvatarCropDialog
          file={new File(['input'], 'photo.png', { type: 'image/png' })}
          onCancel={cancel}
          onSave={save}
        />
      </MemoryRouter>,
    )
    await waitFor(() => expect(drawImage).toHaveBeenCalled())
    expect(screen.getByRole('img')).toHaveAttribute('width', '512')
    expect(save).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Guardar recorte' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.any(File)))
    expect(save.mock.calls[0][0].type).toBe('image/jpeg')
    view.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:crop-test')
    vi.unstubAllGlobals()
  })
})
