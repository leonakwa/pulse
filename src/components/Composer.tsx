'use client';

import { useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/client';
import { createPost } from '@/lib/post-actions';
import { resizeToMax } from '@/lib/image-resize';
import { ALLOWED_TYPES, MAX_INPUT_BYTES } from '@/lib/image-config';
import type { PostView } from '@/lib/posts';

type Props = { userId: string; name: string; avatarUrl: string | null; onCreated: (post: PostView) => void };
type Picked = { id: string; file: File; preview: string };

const MAX_IMAGES = 4;

export function Composer({ userId, name, avatarUrl, onCreated }: Props) {
  const [body, setBody] = useState('');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setError(null);

    const next: Picked[] = [];
    for (const file of files) {
      if (picked.length + next.length >= MAX_IMAGES) {
        setError(`You can add up to ${MAX_IMAGES} photos.`);
        break;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('Photos must be JPG, PNG or WebP.');
        continue;
      }
      if (file.size > MAX_INPUT_BYTES) {
        setError('A photo was too large (over 15 MB).');
        continue;
      }
      next.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });
    }
    setPicked((prev) => [...prev, ...next]);
  }

  function removePicked(id: string) {
    setPicked((prev) => {
      prev.filter((p) => p.id === id).forEach((p) => URL.revokeObjectURL(p.preview));
      return prev.filter((p) => p.id !== id);
    });
  }

  async function submit() {
    if (busy) return; // prevents double submissions
    if (body.trim() === '' && picked.length === 0) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const uploaded: string[] = [];

    try {
      const blobs = await Promise.all(picked.map((p) => resizeToMax(p.file, 1600)));
      for (const blob of blobs) {
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
        uploaded.push(path);
      }

      const res = await createPost(body, uploaded);
      if (res.error || !res.post) throw new Error(res.error ?? 'Could not publish your post.');

      picked.forEach((p) => URL.revokeObjectURL(p.preview));
      setPicked([]);
      setBody('');
      onCreated(res.post);
    } catch (err) {
      // The post was not published, so nothing is left behind in storage.
      if (uploaded.length > 0) await supabase.storage.from('post-images').remove(uploaded);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const empty = body.trim() === '' && picked.length === 0;

  return (
    <section className="border-b border-line pb-4">
      <div className="flex gap-3">
        <Avatar name={name} url={avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <label htmlFor="post-body" className="sr-only">
            What is on your mind?
          </label>
          <textarea
            id="post-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="What is on your mind?"
            className="input resize-none"
          />

          {picked.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {picked.map((p) => (
                <div key={p.id} className="relative overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="Selected photo" className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePicked(p.id)}
                    disabled={busy}
                    aria-label="Remove photo"
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-2.5 py-0.5 text-sm font-semibold text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy || picked.length >= MAX_IMAGES}
                className="btn-ghost !px-0"
              >
                Add photos
              </button>
              <span className="text-xs text-muted">{body.length}/500</span>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={busy || empty}
              className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-fg disabled:opacity-60"
            >
              {busy ? 'Posting...' : 'Post'}
            </button>
          </div>

          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFiles} />
          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
