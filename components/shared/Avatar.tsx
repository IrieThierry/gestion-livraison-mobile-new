import { View, Text, Image } from 'react-native';

/**
 * Avatar rond : photo de l'utilisateur si `photoUrl` est renseignée, sinon
 * ses initiales sur fond émeraude. Partagé entre l'accueil et le profil.
 */
export function Avatar({
  prenom,
  nom,
  photoUrl,
  size = 40,
  textClassName = 'text-xs',
}: {
  prenom?: string | null;
  nom?: string | null;
  photoUrl?: string | null;
  size?: number;
  textClassName?: string;
}) {
  const initials = `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
  const hasPhoto = !!photoUrl;
  return (
    <View
      className="rounded-full overflow-hidden items-center justify-center"
      style={{ width: size, height: size, backgroundColor: hasPhoto ? '#f1f5f9' : '#d1fae5' }}
    >
      {hasPhoto ? (
        <Image
          source={{ uri: photoUrl ?? undefined }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <Text className={`text-emerald-700 dark:text-emerald-400 font-extrabold ${textClassName}`}>
          {initials || '?'}
        </Text>
      )}
    </View>
  );
}
