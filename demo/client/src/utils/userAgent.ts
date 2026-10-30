/**
 * A User-Agent header as something a person can read: "Chrome on Windows". Good enough to
 * tell devices apart; null or unrecognised agents are "Unknown device".
 */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  // Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari".
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : null;

  // iPhone agents also say "Mac OS X", and Android agents also say "Linux".
  const system = /iPhone|iPad|iPod/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'macOS'
          : /CrOS/.test(userAgent)
            ? 'ChromeOS'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : null;

  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Unknown device';
}
