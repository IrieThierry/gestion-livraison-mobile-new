import { useState } from 'react';
import { View, Text, Pressable, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, X } from 'lucide-react-native';

/**
 * Champ date avec libellé. Format de sortie : 'YYYY-MM-DD' (ce que le
 * back-end attend pour dateDebut/dateFin/dateEncaissement/dateVersement).
 *
 * iOS : modal avec spinner natif + bouton 'OK' pour fermer.
 * Android : dialog natif (s'auto-ferme à la sélection).
 */
export function DatePickerField({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  optional?: boolean;
}) {
  const [showIos, setShowIos] = useState(false);
  const [showAndroid, setShowAndroid] = useState(false);

  const dateValue = value ? new Date(value) : new Date();

  const open = () => {
    if (Platform.OS === 'ios') setShowIos(true);
    else setShowAndroid(true);
  };

  const handleChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setShowAndroid(false);
    if (selected) {
      // Format en YYYY-MM-DD (locale-stable)
      const yyyy = selected.getFullYear();
      const mm = String(selected.getMonth() + 1).padStart(2, '0');
      const dd = String(selected.getDate()).padStart(2, '0');
      onChange(`${yyyy}-${mm}-${dd}`);
    }
  };

  const display = value ?? (optional ? 'Non défini' : 'Choisir une date');

  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {label}
        {optional ? ' (optionnel)' : ''}
      </Text>
      <Pressable
        onPress={open}
        className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex-row items-center gap-2 active:opacity-70"
      >
        <Calendar color="#64748b" size={16} />
        <Text
          className={
            value
              ? 'text-slate-900 dark:text-white text-base flex-1'
              : 'text-slate-400 text-base flex-1'
          }
        >
          {display}
        </Text>
        {value && optional ? (
          <Pressable onPress={() => onChange(null)} hitSlop={6}>
            <X color="#94a3b8" size={16} />
          </Pressable>
        ) : null}
      </Pressable>

      {/* Android opens its own modal; iOS needs us to render one */}
      {Platform.OS === 'ios' && showIos ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShowIos(false)}>
          <Pressable className="flex-1 bg-black/40" onPress={() => setShowIos(false)}>
            <Pressable
              onPress={() => {}}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl pt-3 pb-8"
            >
              <View className="flex-row justify-between items-center px-4 pb-2">
                <Text className="font-extrabold text-slate-900 dark:text-white">{label}</Text>
                <Pressable
                  onPress={() => setShowIos(false)}
                  className="bg-emerald-500 px-4 py-1.5 rounded-md active:opacity-80"
                >
                  <Text className="text-white font-bold">OK</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="spinner"
                onChange={handleChange}
                themeVariant="light"
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {Platform.OS === 'android' && showAndroid ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}
