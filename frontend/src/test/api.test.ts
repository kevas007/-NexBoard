import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api'

// Mock fetch global
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock authManager
vi.mock('../utils/auth', () => ({
  authManager: {
    getAuthHeaders: vi.fn(() => ({})),
  },
}))

describe('API Utils', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('apiGet', () => {
    it('makes GET request with correct URL', async () => {
      const mockResponse = { data: 'test' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await apiGet('/test')

      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      expect(result).toEqual(mockResponse)
    })

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      })

      await expect(apiGet('/test')).rejects.toThrow('Not found')
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(apiGet('/test')).rejects.toThrow('Network error')
    })
  })

  describe('apiPost', () => {
    it('makes POST request with data', async () => {
      const mockData = { name: 'test' }
      const mockResponse = { id: 1, ...mockData }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await apiPost('/test', mockData)

      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockData),
      })
      expect(result).toEqual(mockResponse)
    })

    it('handles empty data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await apiPost('/test')

      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    })
  })

  describe('apiPut', () => {
    it('makes PUT request with data', async () => {
      const mockData = { name: 'updated' }
      const mockResponse = { id: 1, ...mockData }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await apiPut('/test/1', mockData)

      expect(mockFetch).toHaveBeenCalledWith('/api/test/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockData),
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('apiDelete', () => {
    it('makes DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await apiDelete('/test/1')

      expect(mockFetch).toHaveBeenCalledWith('/api/test/1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    })
  })

  describe('Error handling', () => {
    it('handles 400 Bad Request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad request' }),
      })

      await expect(apiGet('/test')).rejects.toThrow('Bad request')
    })

    it('handles 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      })

      await expect(apiGet('/test')).rejects.toThrow('Internal server error')
    })

    it('handles JSON parse errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      await expect(apiGet('/test')).rejects.toThrow('Erreur réseau: Invalid JSON')
    })
  })
})
