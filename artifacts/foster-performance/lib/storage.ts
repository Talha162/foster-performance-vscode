import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

/**
 * Every bucket policy requires the object path to start with the uploader's
 * user id, so callers never choose the prefix themselves.
 *
 *   avatars              <uid>/<file>                     public
 *   credentials          <uid>/<file>                     owner + admin
 *   message-attachments  <uid>/<conversation_id>/<file>    conversation members
 */
export type Bucket = 'avatars' | 'credentials' | 'message-attachments';

export type PickedFile = {
  uri: string;
  /** Supabase needs an explicit content type; the buckets only allow a few. */
  contentType: string;
  extension: string;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', pdf: 'application/pdf',
};

function describeFile(uri: string, mimeType?: string | null): PickedFile {
  const fromUri = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const extension = MIME_BY_EXTENSION[fromUri] ? fromUri : 'jpg';
  return { uri, extension, contentType: mimeType || MIME_BY_EXTENSION[extension] || 'image/jpeg' };
}

/** Opens the photo library. Returns null when the person cancels. */
export async function pickImage(options?: { square?: boolean }): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo access is needed to choose an image. You can enable it in Settings.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: options?.square ?? false,
    aspect: options?.square ? [1, 1] : undefined,
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return describeFile(asset.uri, asset.mimeType);
}

/**
 * Uploads a local file URI. React Native has no File object, so the URI is
 * read into an ArrayBuffer first; passing the URI straight to supabase-js
 * uploads an empty object.
 */
async function uploadTo(bucket: Bucket, path: string, file: PickedFile): Promise<string> {
  const response = await fetch(file.uri);
  if (!response.ok) throw new Error('Could not read the selected file.');
  const body = await response.arrayBuffer();
  if (body.byteLength === 0) throw new Error('The selected file is empty.');

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: file.contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function uploadAvatar(userId: string, file: PickedFile): Promise<string> {
  // Overwriting one object per user keeps stale avatars from accumulating.
  const path = `${userId}/avatar.${file.extension}`;
  await uploadTo('avatars', path, file);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Bust the CDN cache, since the path is reused on every change.
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function uploadCredential(userId: string, file: PickedFile): Promise<string> {
  const path = `${userId}/${Date.now()}.${file.extension}`;
  return uploadTo('credentials', path, file);
}

export async function uploadMessageAttachment(
  userId: string, conversationId: string, file: PickedFile,
): Promise<string> {
  // The conversation id must be the second segment: the read policy uses it to
  // decide whether the viewer belongs to the thread.
  const path = `${userId}/${conversationId}/${Date.now()}.${file.extension}`;
  return uploadTo('message-attachments', path, file);
}

/** Private buckets need a short-lived signed URL before anything can render. */
export async function signedUrl(bucket: Bucket, path: string, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) {
    console.error(`[storage] Could not sign ${bucket}/${path}:`, error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function removeFile(bucket: Bucket, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}
