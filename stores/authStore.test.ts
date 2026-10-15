import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(async () => undefined) },
}))
jest.mock('../lib/secure-storage', () => ({
  SecureStorage: { set: jest.fn(), get: jest.fn(), clearAuth: jest.fn(async () => undefined) },
}))
jest.mock('../lib/biometric', () => ({ Biometric: { isAvailable: jest.fn(), authenticate: jest.fn() } }))
jest.mock('../lib/biometrie-choix', () => ({
  migrerAncienChoixBiometrie: jest.fn(async () => null),
  lireChoixBiometrie: jest.fn(async () => null),
}))

import { useAuthStore } from './authStore'
import { queryClient } from '../lib/query-client'
import { SecureStorage } from '../lib/secure-storage'
import { JetonsSession } from '../lib/jetons-session'
import { useCommandePrefillStore } from './commandePrefillStore'
import { Biometric } from '../lib/biometric'
import { lireChoixBiometrie, migrerAncienChoixBiometrie } from '../lib/biometrie-choix'

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

describe('authStore : bouton biométrique de l’écran de connexion', () => {
  const user = { id: 'u', username: 'awa', profile: 'LIVREUR' }
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ user: null })
    ;(SecureStorage.get as jest.Mock).mockResolvedValue('t')
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(user))
    ;(Biometric.isAvailable as jest.Mock).mockResolvedValue(true)
    ;(lireChoixBiometrie as jest.Mock).mockResolvedValue('active')
  })

  it('possible : session gardée, choix « active », appareil compatible', async () => {
    expect(await useAuthStore.getState().deverrouillageBiometriquePossible()).toBe(true)
    expect(lireChoixBiometrie).toHaveBeenCalledWith('awa')
  })

  it.each([
    ['pas de jeton', () => (SecureStorage.get as jest.Mock).mockResolvedValue(null)],
    ['pas d’utilisateur gardé', () => (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)],
    ['choix « refusee »', () => (lireChoixBiometrie as jest.Mock).mockResolvedValue('refusee')],
    ['aucun choix', () => (lireChoixBiometrie as jest.Mock).mockResolvedValue(null)],
    ['appareil non compatible', () => (Biometric.isAvailable as jest.Mock).mockResolvedValue(false)],
    ['choix illisible', () => (lireChoixBiometrie as jest.Mock).mockRejectedValue(new Error('keystore'))],
  ])('impossible : %s', async (_cas, preparer) => {
    preparer()
    expect(await useAuthStore.getState().deverrouillageBiometriquePossible()).toBe(false)
  })

  it('déverrouillage réussi : session restaurée', async () => {
    ;(Biometric.authenticate as jest.Mock).mockResolvedValue(true)
    expect(await useAuthStore.getState().deverrouillerParBiometrie()).toEqual(user)
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('biométrie refusée : pas de session, jetons gardés', async () => {
    ;(Biometric.authenticate as jest.Mock).mockResolvedValue(false)
    expect(await useAuthStore.getState().deverrouillerParBiometrie()).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(SecureStorage.clearAuth).not.toHaveBeenCalled()
  })

  it('choix « refusee » : aucune demande de biométrie', async () => {
    ;(lireChoixBiometrie as jest.Mock).mockResolvedValue('refusee')
    expect(await useAuthStore.getState().deverrouillerParBiometrie()).toBeNull()
    expect(Biometric.authenticate).not.toHaveBeenCalled()
  })
})

describe('authStore : « Se souvenir de moi » (M2)', () => {
  const user = { id: 'u', username: 'awa' } as never
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => JetonsSession.definirPersistance(true))

  it('cochée : jetons en SecureStorage et utilisateur gardé', async () => {
    await useAuthStore.getState().setSession('t', 'r', user, true)
    expect(SecureStorage.set).toHaveBeenCalledWith('access_token', 't')
    expect(SecureStorage.set).toHaveBeenCalledWith('refresh_token', 'r')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(user))
  })

  it('décochée : jetons en mémoire seulement, session gardée d’avant effacée', async () => {
    await useAuthStore.getState().setSession('t', 'r', user, false)
    expect(SecureStorage.set).not.toHaveBeenCalled()
    expect(SecureStorage.clearAuth).toHaveBeenCalled()
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user')
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('user', expect.anything())
    expect(await JetonsSession.get('access_token')).toBe('t')
    expect(await JetonsSession.get('refresh_token')).toBe('r')
    expect(useAuthStore.getState().user).toBe(user)
    // Déconnexion : jetons en mémoire effacés, retour au mode gardé par défaut.
    await useAuthStore.getState().logout()
    expect(JetonsSession.estPersistant()).toBe(true)
  })

  it('majUtilisateur : provisoire levé, gardé seulement si la session est gardée', async () => {
    const maj = { id: 'u', username: 'awa', motDePasseProvisoire: false } as never
    await useAuthStore.getState().majUtilisateur(maj)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(maj))
    JetonsSession.definirPersistance(false)
    ;(AsyncStorage.setItem as jest.Mock).mockClear()
    await useAuthStore.getState().majUtilisateur(maj)
    expect(AsyncStorage.setItem).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBe(maj)
  })
})

describe('authStore : cache des requêtes jamais d’un autre compte (revue I1)', () => {
  const user = { id: 'u', username: 'awa' } as never
  beforeEach(() => {
    jest.clearAllMocks()
    queryClient.setQueryData(['clients'], [{ id: 'c' }])
  })
  afterEach(() => JetonsSession.definirPersistance(true))

  it('autre compte que le propriétaire du cache : cache vidé, propriétaire noté', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('autre')
    await useAuthStore.getState().setSession('t', 'r', user, true)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('GL_QUERY_CACHE')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('GL_QUERY_CACHE_PROPRIETAIRE', 'u')
  })

  it('même compte, session gardée : cache conservé', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('u')
    await useAuthStore.getState().setSession('t', 'r', user, true)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('GL_QUERY_CACHE')
  })

  it('même compte, « Se souvenir de moi » décoché : cache persisté effacé', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('u')
    await useAuthStore.getState().setSession('t', 'r', user, false)
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('GL_QUERY_CACHE')
  })

  it('démarrage sans session restaurable : cache vidé', async () => {
    ;(SecureStorage.get as jest.Mock).mockResolvedValue(null)
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
    await useAuthStore.getState().hydrate()
    expect(useAuthStore.getState().user).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('GL_QUERY_CACHE')
  })
})
