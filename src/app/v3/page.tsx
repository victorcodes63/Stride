import { permanentRedirect } from 'next/navigation';

/** Legacy preview path — production home is `/`. */
export default function StudioCraftPreviewRedirect() {
  permanentRedirect('/');
}
