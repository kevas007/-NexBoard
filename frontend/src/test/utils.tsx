import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'

// Mock pour les utilitaires API
export const mockApiResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  })
}

// Mock pour fetch
export const mockFetch = (response: any, status = 200) => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
    })
  ) as any
}

// Wrapper pour les tests avec React Router
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Mock pour localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
  }
}

// Mock pour les notifications toast
export const mockToast = () => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
})

// Mock pour les hooks personnalisés
export const mockUseSSE = (data: any = null, error: any = null) => ({
  data,
  error,
  isConnected: !error,
  reconnect: vi.fn(),
})

// Mock pour les composants Lucide React
export const mockLucideIcons = () => {
  const MockIcon = ({ className, ...props }: any) => (
    <div data-testid="mock-icon" className={className} {...props} />
  )

  return {
    Save: MockIcon,
    Mail: MockIcon,
    Bell: MockIcon,
    Server: MockIcon,
    CheckCircle: MockIcon,
    XCircle: MockIcon,
    Info: MockIcon,
    TestTube: MockIcon,
  }
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }
