// Shared by the upload component (browser) and the server actions.
export const IMAGE_KINDS = {
  avatar: { bucket: 'avatars', column: 'avatar_url', width: 512, height: 512, label: 'Profile picture' },
  cover: { bucket: 'covers', column: 'cover_url', width: 1500, height: 500, label: 'Cover photo' },
} as const;

export type ImageKind = keyof typeof IMAGE_KINDS;

export const ALLOWED_TYPES: string[] = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_INPUT_BYTES = 15 * 1024 * 1024; // phone photos are shrunk before upload
