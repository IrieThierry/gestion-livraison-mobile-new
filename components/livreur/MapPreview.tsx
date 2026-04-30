import { View, Image, Text } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { latLngToTile, tileUrl } from '../../lib/osm-tiles';

const ZOOM = 16;

/**
 * Static OpenStreetMap tile preview with a pin overlay at the exact
 * lat/lng location. Pure JS — no native module — so it works in Expo Go.
 */
export function MapPreview({
  lat,
  lng,
  size = 280,
}: {
  lat: number;
  lng: number;
  size?: number;
}) {
  const { tileX, tileY, pinXFraction, pinYFraction } = latLngToTile(lat, lng, ZOOM);
  const url = tileUrl(ZOOM, tileX, tileY);

  // The MapPin icon is anchored at its tip (bottom-center). We size it 32px
  // so the visible pin tip points exactly at (pinX, pinY).
  const PIN = 32;
  const pinX = pinXFraction * size;
  const pinY = pinYFraction * size;

  return (
    <View
      className="bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
      style={{ width: size, height: size, alignSelf: 'center' }}
    >
      <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="cover" />
      <View
        style={{
          position: 'absolute',
          left: pinX - PIN / 2,
          top: pinY - PIN, // anchor at the pin's tip
          width: PIN,
          height: PIN,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <View className="absolute" style={{ top: 0 }}>
          <MapPin
            color="#ef4444"
            fill="#ef4444"
            size={PIN}
            strokeWidth={1.5}
          />
        </View>
      </View>
      {/* Attribution — required by OSM tile usage policy */}
      <View
        className="absolute bottom-0 right-0 bg-white/80 dark:bg-slate-900/80 px-1"
        style={{ borderTopLeftRadius: 4 }}
      >
        <Text className="text-[8px] text-slate-700 dark:text-slate-300">© OpenStreetMap</Text>
      </View>
    </View>
  );
}
