'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/Avatar';
import { ALLOWED_TYPES, IMAGE_KINDS, MAX_INPUT_BYTES, type ImageKind } from '@/lib/image-config';
import { resizeImage } from '@/lib/image-resize';
import { removeProfileImage, saveProfileImage } from '@/lib/profile-image-actions';

type Props = { kind: ImageKind; userId: string; name: string; currentUrl: string | null };

export function ImagePicker({ kind, userId, name, currentUrl }: Props) {
  const cfg = IMAGE_KINDS[kind];
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(currentUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be chosen again
    if (!file) return;

    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError('That image is too large. Choose one under 15 MB.');
      return;
    }

    setBusy(true);
    const supabase = createClient();
    let path: string | null = null;
    let saved = false;

    try {
      const blob = await resizeImage(file, cfg.width, cfg.height);
      path = `${userId}/${Date.now()}-${crypto.randomUUID()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(cfg.bucket)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const result = await saveProfileImage(kind, path);
      if (result.error) throw new Error(result.error);

      saved = true;
      setUrl(result.url ?? null);
    } catch (err) {
      if (path && !saved) await supabase.storage.from(cfg.bucket).remove([path]); // no orphan files
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }

    if (saved) router.refresh();
  }

  async function onRemove() {
    setError(null);
    setBusy(true);
    const result = await removeProfileImage(kind);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setUrl(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="label">{cfg.label}</p>

      {kind === 'cover' ? (
        <div className="h-28 overflow-hidden rounded-xl bg-gradient-to-br from-brand/40 via-brand/10 to-surface">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
      ) : (
        <Avatar name={name} url={url} size={80} />
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand disabled:opacity-60"
        >
          {busy ? 'Working...' : url ? 'Change' : 'Upload'}
        </button>
        {url && !busy ? (
          <button type="button" onClick={onRemove} className="btn-ghost">
            Remove
          </button>
        ) : null}
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
