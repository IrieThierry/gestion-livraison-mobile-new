jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

import { queryClient } from './query-client'

describe('queryClient', () => {
  it('ne rejoue jamais automatiquement les mutations', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(0)
  })

  it('ne met jamais une mutation en pause hors ligne (pas de rejeu au retour du réseau)', () => {
    expect(queryClient.getDefaultOptions().mutations?.networkMode).toBe('always')
  })
})
