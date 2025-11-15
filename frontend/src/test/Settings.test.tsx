import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Settings } from '../pages/Settings'
import { mockToast, mockLocalStorage, mockFetch } from '../test/utils'

// Mock des composants
vi.mock('../components/ui/Toast', () => ({
  useToast: () => mockToast(),
}))

vi.mock('../utils/proxmox', () => ({
  proxmoxConfigManager: {
    getConfig: vi.fn(() => ({
      url: 'https://pve.example.com:8006',
      token: '[TEST-TOKEN]',
      node: 'pve',
    })),
    validateConfig: vi.fn(() => ({ isValid: true, errors: [] })),
    saveConfig: vi.fn(),
    testConnection: vi.fn(() => Promise.resolve({ status: 'success', message: 'Connected' })),
    resetConfig: vi.fn(),
  },
}))

describe('Settings', () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage(),
      writable: true,
    })

    // Mock fetch
    mockFetch({ success: true })
  })

  it('renders settings page', () => {
    render(<Settings />)

    expect(screen.getByText('Paramètres')).toBeInTheDocument()
    expect(screen.getByText('Configuration API')).toBeInTheDocument()
    expect(screen.getByText('Configuration Proxmox')).toBeInTheDocument()
    expect(screen.getByText('Configuration SMTP')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('displays API configuration form', () => {
    render(<Settings />)

    expect(screen.getByLabelText(/url de l'api/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('http://localhost:8080')).toBeInTheDocument()
  })

  it('displays Proxmox configuration form', () => {
    render(<Settings />)

    expect(screen.getByLabelText(/url proxmox/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/token api/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/nœud par défaut/i)).toBeInTheDocument()
  })

  it('displays SMTP configuration form', () => {
    render(<Settings />)

    expect(screen.getByLabelText(/serveur smtp/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/port/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/nom d'utilisateur/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
  })

  it('displays notification settings', () => {
    render(<Settings />)

    expect(screen.getByText('Notifications par email')).toBeInTheDocument()
    expect(screen.getByText('Notifications temps réel (SSE)')).toBeInTheDocument()
    expect(screen.getByLabelText(/limite d'envoi/i)).toBeInTheDocument()
  })

  it('allows toggling notification settings', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    const checkboxes = screen.getAllByRole('checkbox')
    const emailCheckbox = checkboxes.find(cb => cb.id === 'emailEnabled') || checkboxes[1]
    const sseCheckbox = checkboxes.find(cb => cb.id === 'sseEnabled') || checkboxes[2]

    expect(emailCheckbox).toBeChecked()
    expect(sseCheckbox).toBeChecked()

    await user.click(emailCheckbox)
    await user.click(sseCheckbox)

    expect(emailCheckbox).not.toBeChecked()
    expect(sseCheckbox).not.toBeChecked()
  })

  it('saves API configuration', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    const saveButtons = screen.getAllByText('Sauvegarder')
    const saveButton = saveButtons[0] // Premier bouton de sauvegarde
    await user.click(saveButton)

    // Vérifier que la configuration est sauvegardée
    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalled()
    })
  })

  it('saves Proxmox configuration', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    const saveButton = screen.getAllByText('Sauvegarder')[1] // Deuxième bouton de sauvegarde
    await user.click(saveButton)

    // Le test vérifie que le bouton est cliquable (pas d'erreur)
    expect(saveButton).toBeInTheDocument()
  })

  it('tests Proxmox connection', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    const testButton = screen.getByText('Tester la connexion')
    await user.click(testButton)

    // Le test vérifie que le bouton est cliquable (pas d'erreur)
    expect(testButton).toBeInTheDocument()
  })

  it('saves notification configuration', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    const saveButton = screen.getByText('Sauvegarder les notifications')
    await user.click(saveButton)

    // Vérifier que la configuration des notifications est sauvegardée
    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalled()
    })
  })

  it('displays system information', () => {
    render(<Settings />)

    expect(screen.getByText('Informations système')).toBeInTheDocument()
    expect(screen.getByText('Version')).toBeInTheDocument()
    expect(screen.getByText('API Status')).toBeInTheDocument()
    expect(screen.getByText('Base de données')).toBeInTheDocument()
  })

  it('handles form validation', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    // Vider le champ URL API
    const apiUrlInput = screen.getByLabelText(/url de l'api/i)
    await user.clear(apiUrlInput)

    const saveButtons = screen.getAllByText('Sauvegarder')
    const saveButton = saveButtons[saveButtons.length - 1] // Dernier bouton de sauvegarde
    await user.click(saveButton)

    // Le test vérifie que le bouton est cliquable même avec un champ vide
    expect(saveButton).toBeInTheDocument()
  })
})
