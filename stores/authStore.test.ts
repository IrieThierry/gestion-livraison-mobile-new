import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(async () => undefined) },
}))
jest.mock('../lib/secure-storage', () => ({
  SecureStorage: { set: jest.fn(), get: jest.fn(), clearAuth: jest.fn(async () => undefined) },
}))
jest.mock('../lib/biometric', () => ({ Biometric: { isAvailable: jest.fn(), authenticate: jest.fn() } }))
jest.mock('../lib/biometrie-choix', () => ({ migrerAncienChoixBiometrie: jest.fn(async () => null) }))

import { useAuthStore } from './authStore'
import { queryClient } from '../lib/query-client'
import { SecureStorage } from '../lib/secure-storage'
import { useCommandePrefillStore } from './commandePrefillStore'
import { Biometric } from '../lib/biometric'
import { migrerAncienChoixBiometrie } from '../lib/biometrie-choix'

describe('authStore.logout', () => {
  it('vide le cache TanStack Query et la clé persistée', async () => {
    queryClient.setQueryData(['livraisons'], [{ id: 'x' }])
    useAuthStore.setState({ user: { id: 'u' } as never })
    useCommandePrefillStore.getState().definir({ fournisseurId: 'f', jour: '2026-10-13', cumul: [] })

    await useAuthStore.getState().logout()

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('GL_QUERY_CACHE')
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user')
    expect(SecureStorage.clearAuth).toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
    // Préremplissage « Commander » non consommé : jamais repris par le compte suivant.
    expect(useCommandePrefillStore.getState().source).toBeNull()
  })
})

describe('authStore.hydrate : déverrouillage biométrique selon le choix du compte (S4)', () => {
  const user = { id: 'u', username: 'awa' }
  beforeEach(() => {
    jest.clearAllMocks()
    ;(SecureStorage.get as jest.Mock).mockResolvedValue('t')
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(user))
    ;(Biometric.isAvailable as jest.Mock).mockResolvedValue(true)
  })

  it('« active » : demande la biométrie ; échec → pas de session', async () => {
    ;(migrerAncienChoixBiometrie as jest.Mock).mockResolvedValue('active')
    ;(Biometric.authenticate as jest.Mock).mockResolvedValue(false)
    await useAuthStore.getState().hydrate()
    expect(migrerAncienChoixBiometrie).toHaveBeenCalledWith('awa')
    expect(Biometric.authenticate).toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('« active » et biométrie réussie : session restaurée', async () => {
    ;(migrerAncienChoixBiometrie as jest.Mock).mockResolvedValue('active')
    ;(Biometric.authenticate as jest.Mock).mockResolvedValue(true)
    await useAuthStore.getState().hydrate()
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('choix illisible (erreur du stockage) : pas de session sans vérification', async () => {
    ;(migrerAncienChoixBiometrie as jest.Mock).mockRejectedValue(new Error('keystore'))
    await useAuthStore.getState().hydrate()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isHydrated).toBe(true)
    // Jetons gardés : seule une reconnexion restaure la session.
    expect(SecureStorage.clearAuth).not.toHaveBeenCalled()
  })

  it.each([['refusee'], [null]])('choix %s : pas de biométrie, session restaurée', async (choix) => {
    ;(migrerAncienChoixBiometrie as jest.Mock).mockResolvedValue(choix)
    await useAuthStore.getState().hydrate()
    expect(Biometric.authenticate).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toEqual(user)
  })
})
