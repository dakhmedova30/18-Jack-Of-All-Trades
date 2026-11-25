import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, getErrorMessage } from '../../api/http';
import { getPublicProfile } from '../../api/publicProfile';
import type { PublicProfile } from '../../types';
import { formatCentsIn } from '../../utils/money';

type Result =
  | { slug: string; profile: PublicProfile }
  | { slug: string; notFound: true }
  | { slug: string; error: string };

/** The labels for the profile's links, in the order they're shown. */
const LINKS = [
  ['website', 'Website'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'],
  ['etsy', 'Etsy'],
] as const;

/** /p/:slug — a business's public profile, for customers. Works logged in or out. */
export function PublicProfilePage() {
  const { slug = '' } = useParams();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicProfile(slug)
      .then((profile) => {
        if (!cancelled) setResult({ slug, profile });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) setResult({ slug, notFound: true });
        else setResult({ slug, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const profile = result?.slug === slug && 'profile' in result ? result.profile : null;

  useEffect(() => {
    if (!profile) return;
    const previous = document.title;
    document.title = `${profile.name} | Jack-Of-All-Trades`;
    return () => {
      document.title = previous;
    };
  }, [profile]);

  let body;
  if (!result || result.slug !== slug) {
    body = <p className="muted">Loading…</p>;
  } else if ('notFound' in result) {
    body = (
      <div className="empty-state">
        <h1>Profile not found</h1>
        <p>There is no public profile at this link. Check the link with the business.</p>
      </div>
    );
  } else if ('error' in result) {
    body = <p className="form-error">{result.error}</p>;
  } else {
    body = <ProfileView profile={result.profile} />;
  }

  return (
    <div className="legal-page">
      <header className="legal-page__header">
        <Link to="/" className="legal-page__brand">
          Jack-Of-All-Trades
        </Link>
      </header>
      <main className="public-profile">{body}</main>
    </div>
  );
}

function ProfileView({ profile }: { profile: PublicProfile }) {
  const location = [profile.city, profile.region].filter(Boolean).join(', ');
  const links = LINKS.flatMap(([key, label]) => {
    const href = profile[key];
    return href ? [{ href, label }] : [];
  });
  // Shown only if the owner chose to; the text is the address itself, so customers can copy it.
  const contacts: { href: string; text: string; label: string }[] = [];
  if (profile.email) {
    contacts.push({ href: `mailto:${profile.email}`, text: profile.email, label: 'Email' });
  }
  if (profile.phone) {
    // tel: links take digits and a leading +, without the spaces or dashes people type.
    const digits = profile.phone.replace(/[^\d+]/g, '');
    contacts.push({ href: `tel:${digits}`, text: profile.phone, label: 'Phone' });
  }

  return (
    <>
      <section className="public-profile__hero">
        {profile.logoUrl && (
          <img
            className="public-profile__logo"
            src={profile.logoUrl}
            alt={`${profile.name} logo`}
          />
        )}
        <div>
          <h1>{profile.name}</h1>
          {location && <p className="muted">{location}</p>}
          {profile.description && <p>{profile.description}</p>}
          {contacts.length > 0 && (
            <ul className="public-profile__links" aria-label="Contact">
              {contacts.map(({ href, text, label }) => (
                <li key={label}>
                  <span className="muted">{label}:</span> <a href={href}>{text}</a>
                </li>
              ))}
            </ul>
          )}
          {links.length > 0 && (
            <ul className="public-profile__links">
              {links.map(({ href, label }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="public-products">
        <h2 id="public-products">Products</h2>
        {profile.items.length === 0 ? (
          <p className="muted">No products listed yet.</p>
        ) : (
          <ul className="public-profile__grid">
            {profile.items.map((item) => (
              <li key={item.id} className="public-item card">
                <span className="public-item__tile" aria-hidden="true">
                  {item.name.charAt(0).toUpperCase()}
                </span>
                <span className="public-item__name">{item.name}</span>
                <span>{formatCentsIn(item.unitPriceCents, profile.currency)}</span>
                <span className={item.inStock ? 'public-item__stock' : 'public-item__stock--out'}>
                  {item.inStock ? 'In stock' : 'Sold out'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
