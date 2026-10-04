import { extractApiErrorMessage } from './api-error'

const apiErr = (status: number, message: unknown) => ({ response: { status, data: { success: false, message } } })

describe('extractApiErrorMessage', () => {
  it('renvoie le message texte du back (règle métier)', () => {
    expect(extractApiErrorMessage(apiErr(400, 'Stock insuffisant'))).toBe('Stock insuffisant')
  })

  it("concatène les messages d'un objet de validation sans [object Object]", () => {
    const msg = extractApiErrorMessage(apiErr(400, { montant: 'Doit être positif', clientId: 'Obligatoire' }))
    expect(msg).toBe('Doit être positif ; Obligatoire')
    expect(msg).not.toContain('[object Object]')
  })

  it('409 : message de modification concurrente', () => {
    const msg = extractApiErrorMessage(apiErr(409, 'conflit'))
    expect(msg).toMatch(/modifié entre-temps/)
    expect(msg).toMatch(/rechargez/)
  })

  it('retombe sur le message par défaut si objet vide', () => {
    expect(extractApiErrorMessage(apiErr(400, {}), 'Défaut')).toBe('Défaut')
  })

  it('traduit les doublons SQL', () => {
    expect(extractApiErrorMessage(apiErr(500, 'duplicate key ... username'))).toMatch(/nom d'utilisateur/)
  })
})
