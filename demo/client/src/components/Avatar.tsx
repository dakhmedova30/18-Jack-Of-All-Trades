import { useState } from 'react';

/**
 * The first letter of each word: "Acme" -> "A", "Demo Business" -> "DB",
 * "Jack of All Trades" -> "JOAT". A word with no letter or digit in it (like the "&" in
 * "Smith & Sons") is skipped, so that gives "SS", not "S&S".
 */
export function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((letter): letter is string => letter !== undefined);
  return initials.length > 0 ? initials.join('').toUpperCase() : '?';
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
  const initials = getInitials(name);
  // Names with many words give many letters; shrink the text so they still fit the circle.
  const fontSize = initials.length <= 2 ? undefined : initials.length === 3 ? '0.7rem' : '0.55rem';
  return (
    <span className="avatar avatar--initials" aria-hidden="true" style={{ fontSize }}>
      {initials}
    </span>
  );
}
