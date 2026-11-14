import type { MetadataRoute } from 'next';

// Lets people add PulseHive to their phone's home screen with the logo as the app icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PulseHive',
    short_name: 'PulseHive',
    description: 'Share moments, connect with people and earn XP for genuine participation.',
    start_url: '/feed',
    display: 'standalone',
    background_color: '#0B1020',
    theme_color: '#0B1020',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
