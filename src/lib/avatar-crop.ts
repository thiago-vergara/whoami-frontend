export const AVATAR_SIZE = 512
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024

export function cropRegion(width: number, height: number, zoom: number, x: number, y: number) {
  if (width <= 0 || height <= 0) throw new Error('La imagen no tiene dimensiones válidas.')
  const size = Math.min(width, height) / Math.max(1, Math.min(4, zoom))
  const left = ((width - size) / 2) * (1 + Math.max(-100, Math.min(100, x)) / 100)
  const top = ((height - size) / 2) * (1 + Math.max(-100, Math.min(100, y)) / 100)
  return { left, top, size }
}

export async function loadCropImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Elige una imagen PNG, JPEG o WebP.')
  if (!file.size || file.size > MAX_SOURCE_BYTES)
    throw new Error('La imagen original debe pesar como máximo 10 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 24000000
    )
      throw new Error('Elige una imagen de hasta 24 megapíxeles.')
    return { image, url }
  } catch (error) {
    URL.revokeObjectURL(url)
    if (error instanceof Error && error.message.includes('megapíxeles')) throw error
    throw new Error('No pudimos abrir esa imagen. Prueba con otra foto.')
  }
}

export function drawCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  zoom: number,
  x: number,
  y: number,
) {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Tu navegador no permite preparar la foto.')
  const box = cropRegion(image.naturalWidth, image.naturalHeight, zoom, x, y)
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
  context.drawImage(image, box.left, box.top, box.size, box.size, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
}

export async function exportCrop(canvas: HTMLCanvasElement): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('No pudimos preparar el recorte.'))),
      'image/jpeg',
      0.9,
    ),
  )
  if (blob.size > 2097152) throw new Error('El recorte supera 2 MB. Prueba con otra imagen.')
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
}
