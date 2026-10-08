import { useMemo } from 'react';
import { Text } from 'react-native';
import { SelectField, type SelectOption } from '../shared/SelectField';
import { useApprentisAffectables } from '../../features/commandes/hooks';
import { extractApiErrorMessage } from '../../lib/api-error';
import type { PersonneRef, UUID } from '../../types/api';

/** Valeur de l'option « Aucun » (aucun apprenti affecté). */
const AUCUN = '__aucun__';

/**
 * Choix de l'apprenti affecté à une commande (livreur principal seulement) :
 * ses apprentis validés, actifs et non bloqués par ce fournisseur, plus « Aucun ».
 * `actuel` garde visible un apprenti déjà affecté qui ne serait plus affectable.
 */
export function ApprentiAffecteField({
  fournisseurId,
  value,
  onChange,
  actuel,
  disabled,
}: {
  fournisseurId: UUID | undefined;
  value: UUID | null;
  onChange: (apprentiId: UUID | null) => void;
  actuel?: PersonneRef | null;
  disabled?: boolean;
}) {
  const q = useApprentisAffectables(fournisseurId, !disabled);

  const options = useMemo<SelectOption[]>(() => {
    const apprentis: SelectOption[] = (q.data ?? []).map((a) => ({
      id: a.id,
      label: `${a.prenom ?? ''} ${a.nom ?? ''}`.trim() || a.username,
    }));
    if (actuel && !apprentis.some((a) => a.id === actuel.id)) {
      apprentis.push({ id: actuel.id, label: actuel.nom, hint: 'Affecté actuellement' });
    }
    return [{ id: AUCUN, label: 'Aucun' }, ...apprentis];
  }, [q.data, actuel]);

  if (disabled) return null;

  return (
    <>
      <SelectField
        label="Apprenti affecté"
        placeholder="Aucun"
        value={value ?? AUCUN}
        onChange={(next) => onChange(!next || next === AUCUN ? null : next)}
        options={options}
        isLoading={q.isLoading}
        emptyMessage="Aucun apprenti affectable"
      />
      {q.isError ? (
        <Text className="text-[11px] text-red-600 dark:text-red-400 mt-1">
          {extractApiErrorMessage(q.error, 'Apprentis indisponibles')}
        </Text>
      ) : null}
    </>
  );
}
