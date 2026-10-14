import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Fingerprint } from 'lucide-react-native';
import { Biometric } from '../../lib/biometric';
import {
  enregistrerChoixBiometrie,
  lireChoixBiometrie,
  type ChoixBiometrie,
} from '../../lib/biometrie-choix';
import { dialog } from '../../lib/dialog';

export const LIBELLE_INTERRUPTEUR_BIOMETRIE = 'Déverrouiller avec Face ID / empreinte';

/**
 * S4 : Moi → Profil, interrupteur du déverrouillage biométrique pour le
 * compte connecté. Affiché seulement si l'appareil est compatible (capteur
 * présent et biométrie enregistrée). Activé = `active`, désactivé = `refusee`
 * (la question de la connexion ne revient pas).
 */
export function InterrupteurBiometrie({ username }: { username: string }) {
  const [compatible, setCompatible] = useState(false);
  const [choix, setChoix] = useState<ChoixBiometrie | null>(null);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const ok = await Biometric.isAvailable();
        if (!actif || !ok) return;
        const c = await lireChoixBiometrie(username);
        if (!actif) return;
        setChoix(c);
        setCompatible(true);
      } catch {
        // Biométrie indisponible : pas d'interrupteur.
      }
    })();
    return () => {
      actif = false;
    };
  }, [username]);

  if (!compatible) return null;

  const onChange = async (active: boolean) => {
    const nouveau: ChoixBiometrie = active ? 'active' : 'refusee';
    const avant = choix;
    setChoix(nouveau);
    try {
      await enregistrerChoixBiometrie(username, nouveau);
    } catch {
      setChoix(avant);
      dialog.error('Action impossible', 'Le choix n’a pas pu être enregistré.');
    }
  };

  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
      <View className="flex-row items-center gap-3 flex-1">
        <Fingerprint color="#0d9488" size={20} />
        <Text className="flex-1 font-extrabold text-slate-900 dark:text-white">{LIBELLE_INTERRUPTEUR_BIOMETRIE}</Text>
      </View>
      <Switch
        value={choix === 'active'}
        onValueChange={onChange}
        accessibilityLabel={LIBELLE_INTERRUPTEUR_BIOMETRIE}
        trackColor={{ true: '#10b981', false: '#cbd5e1' }}
        thumbColor="#ffffff"
      />
    </View>
  );
}
