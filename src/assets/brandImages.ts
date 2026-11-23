import type { ImageSourcePropType } from 'react-native';

/** Marketing/brand imagery bundled with the app (no remote hotlinking). */
export const BRAND_IMAGES: Record<string, ImageSourcePropType> = {
  welcome: require('../../assets/brand-welcome.jpg'),
};
