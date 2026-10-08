import { creerVerrou, lancerUneFois } from './verrou';

describe('lancerUneFois', () => {
  it('deux appels avant la fin : un seul envoi', () => {
    const verrou = creerVerrou();
    const envoyer = jest.fn();
    expect(lancerUneFois(verrou, () => envoyer())).toBe(true);
    expect(lancerUneFois(verrou, () => envoyer())).toBe(false);
    expect(envoyer).toHaveBeenCalledTimes(1);
  });

  it('libéré à la fin : un nouvel envoi est possible', () => {
    const verrou = creerVerrou();
    const envoyer = jest.fn();
    let fin = () => {};
    lancerUneFois(verrou, (f) => {
      envoyer();
      fin = f;
    });
    fin();
    expect(lancerUneFois(verrou, () => envoyer())).toBe(true);
    expect(envoyer).toHaveBeenCalledTimes(2);
  });
});
