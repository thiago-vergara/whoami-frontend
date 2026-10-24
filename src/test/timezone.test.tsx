import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import TimezoneSelect from '../components/TimezoneSelect'
function Form() {
  const [value, setValue] = useState('America/Lima')
  return (
    <>
      <label htmlFor="zone">Zona horaria</label>
      <TimezoneSelect id="zone" value={value} onChange={setValue} />
      <output>{value}</output>
      <button>Fuera</button>
    </>
  )
}
describe('Selector de zona anclado al campo', () => {
  it('despliega opciones dentro del contenedor y conserva el valor IANA', async () => {
    render(<Form />)
    const user = userEvent.setup()
    const field = screen.getByRole('combobox', { name: 'Zona horaria' })
    await user.click(field)
    const list = screen.getByRole('listbox')
    expect(field.parentElement).toContainElement(list)
    await user.click(screen.getByRole('option', { name: 'Madrid' }))
    expect(screen.getByRole('status')).toHaveTextContent('Europe/Madrid')
    expect(field).toHaveTextContent('Madrid')
    expect(field).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('opera por teclado y cierra con Escape o al salir', async () => {
    render(<Form />)
    const user = userEvent.setup()
    const field = screen.getByRole('combobox')
    field.focus()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(field).toHaveTextContent('Bogotá')
    await user.click(field)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.click(field)
    await user.click(screen.getByRole('button', { name: 'Fuera' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
