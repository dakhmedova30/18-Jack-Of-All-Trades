import { useState } from 'react';

/** "Demo Business" -> "DB". First and last word's first letters; one word -> its first letter. */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) return '?';
  const letter = (word: string) => [...word][0]!; // spread keeps emoji/accents whole
  return (words.length === 1 ? letter(first) : letter(first) + letter(last)).toUpperCase();
}

interface AvatarProps {
  name: string;
  /** Profile picture, if the account has one. Falls back to initials when missing or broken. */
  imageUrl?: string | null;
}

/** A circle showing the account's picture, or its initials when there isn't one. Decorative:
 *  whatever wraps it (a button) carries the accessible name. */
export function Avatar({ name, imageUrl }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    return <img className="avatar" src={imageUrl} alt="" onError={() => setFailed(true)} />;
  }
  return (
    <span className="avatar avatar--initials" aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}
