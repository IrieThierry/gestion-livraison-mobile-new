import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(async () => undefined) },
}))
jest.mock('../lib/secure-storage', () => ({
  SecureStorage: { set: jest.fn(), get: jest.fn(), clearAuth: jest.fn(async () => undefined) },
}))
jest.mock('../lib/biometric', () => ({ Biometric: { isAvailable: jest.fn(), authenticate: jest.fn() } }))

import { useAuthStore } from './authStore'
import { queryClient } from '../lib/query-client'
import { SecureStorage } from '../lib/secure-storage'

describe('authStore.logout', () => {
  it('vide le cache TanStack Query et la clé persistée', async () => {
    queryClient.setQueryData(['livraisons'], [{ id: 'x' }])
    useAuthStore.setState({ user: { id: 'u' } as never })

    await useAuthStore.getState().logout()

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('GL_QUERY_CACHE')
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user')
    expect(SecureStorage.clearAuth).toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
