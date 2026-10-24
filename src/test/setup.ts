import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})
Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true })
if (!HTMLDialogElement.prototype.showModal)
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
if (!HTMLDialogElement.prototype.close)
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:whoami-test')
if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn()
