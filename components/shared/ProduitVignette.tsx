import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { initialeProduit, teinteProduit, urlPhotoProduit } from '../../features/produits/vignette';

/**
 * Vignette carrée d'un produit (G6) : sa photo si elle existe, sinon
 * l'initiale de la désignation dans un cercle coloré. Une photo qui ne se
 * charge pas retombe aussi sur l'initiale.
 */
export function ProduitVignette({
  designation,
  photoUrl,
  size = 36,
}: {
  designation?: string | null;
  photoUrl?: string | null;
  size?: number;
}) {
  const uri = urlPhotoProduit(photoUrl);
  const [enEchec, setEnEchec] = useState<string | null>(null);
  const avecPhoto = !!uri && enEchec !== uri;

  if (avecPhoto) {
    return (
      <View
        className="rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800"
        style={{ width: size, height: size }}
      >
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={() => setEnEchec(uri)}
          accessibilityLabel={designation ? `Photo de ${designation}` : 'Photo du produit'}
        />
      </View>
    );
  }

  const teinte = teinteProduit(designation);
  return (
    <View
      className="rounded-full items-center justify-center"
      style={{ width: size, height: size, backgroundColor: teinte.fond }}
    >
      <Text style={{ color: teinte.texte, fontSize: Math.round(size * 0.42), fontWeight: '800' }}>
        {initialeProduit(designation)}
      </Text>
    </View>
  );
}
