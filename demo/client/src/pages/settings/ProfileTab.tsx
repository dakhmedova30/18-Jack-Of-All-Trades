import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/http';
import type { BusinessUpdate } from '../../api/auth';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../hooks/useAuth';
import type { Business } from '../../types';
import { resizeToFit, resizeToSquareJpeg } from '../../utils/resizeImage';
import { SettingsRow } from './SettingsRow';

const MAX_PICKED_BYTES = 10 * 1024 * 1024;
const DESCRIPTION_MAX = 300;

/** A preview next to Upload / Remove buttons. `onPick` gets the chosen image file. */
function PictureControl({
  preview,
  hasImage,
  hint,
  onPick,
  onRemove,
}: {
  preview: ReactNode;
  hasImage: boolean;
  hint: string;
  onPick: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // so picking the same file again still fires onChange
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file');
    if (file.size > MAX_PICKED_BYTES) return setError('That image is too large (10 MB max)');
    void run(() => onPick(file));
  }

  return (
    <div className="settings-profile">
      {preview}
      <div className="settings-profile__actions">
        <div className="settings-profile__buttons">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={handlePick}
            aria-label="Choose an image file"
          />
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? 'Working…' : hasImage ? 'Change' : 'Upload'}
          </button>
          {hasImage && (
            <button
              type="button"
              className="button button--secondary"
              disabled={busy}
              onClick={() => void run(onRemove)}
            >
              Remove
            </button>
          )}
        </div>
        <p className="muted">{hint}</p>
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}

type DetailKey = Exclude<
  keyof BusinessUpdate,
  'name' | 'businessType' | 'country' | 'timeZone' | 'currency' | 'lowStockThreshold' | 'publicSlug'
>;

/** Saved details as form values: null becomes "". */
function detailsOf(business: Business): Record<DetailKey, string> {
  return {
    ownerFirstName: business.ownerFirstName ?? '',
    ownerLastName: business.ownerLastName ?? '',
    phone: business.phone ?? '',
    addressLine: business.addressLine ?? '',
    city: business.city ?? '',
    region: business.region ?? '',
    postalCode: business.postalCode ?? '',
    description: business.description ?? '',
    website: business.website ?? '',
    instagram: business.instagram ?? '',
    facebook: business.facebook ?? '',
    tiktok: business.tiktok ?? '',
    etsy: business.etsy ?? '',
  };
}

/** Owner, contact, description and links, saved together with one button. */
function DetailsForm({ business }: { business: Business }) {
  const { updateBusiness } = useAuth();
  const saved = detailsOf(business);
  const [values, setValues] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // After a save the server may have tidied a value (e.g. added https://), so show what it kept.
  // Keyed on the details only, so uploading a picture mid-edit doesn't wipe unsaved typing.
  const savedKey = JSON.stringify(saved);
  const [shownKey, setShownKey] = useState(savedKey);
  if (shownKey !== savedKey) {
    setShownKey(savedKey);
    setValues(saved);
  }

  const changed = (Object.keys(values) as DetailKey[]).some(
    (key) => values[key].trim() !== saved[key],
  );

  function field(
    key: DetailKey,
    label: string,
    props: { type?: string; placeholder?: string } = {},
  ) {
    return (
      <SettingsRow label={label}>
        <input
          className="settings-row__input"
          aria-label={label}
          value={values[key]}
          onChange={(event) => {
            setValues({ ...values, [key]: event.target.value });
            setJustSaved(false);
          }}
          {...props}
        />
      </SettingsRow>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const trimmed = Object.fromEntries(
        (Object.keys(values) as DetailKey[]).map((key) => [key, values[key].trim()]),
      );
      await updateBusiness(trimmed);
      setJustSaved(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-stack" onSubmit={handleSubmit} noValidate>
      <h3 className="settings-section">Owner</h3>
      {field('ownerFirstName', 'First name')}
      {field('ownerLastName', 'Last name')}

      <h3 className="settings-section">Contact</h3>
      {field('phone', 'Phone', { type: 'tel', placeholder: '+1 604 555 0199' })}
      {field('addressLine', 'Street address')}
      {field('city', 'City')}
      {field('region', 'Province / state')}
      {field('postalCode', 'Postal code')}

      <h3 className="settings-section">About your business</h3>
      <SettingsRow label="Description">
        <textarea
          className="settings-row__input"
          aria-label="Description"
          rows={3}
          maxLength={DESCRIPTION_MAX}
          value={values.description}
          onChange={(event) => {
            setValues({ ...values, description: event.target.value });
            setJustSaved(false);
          }}
        />
      </SettingsRow>
      <SettingsRow label="">
        <span className="muted">
          {values.description.length}/{DESCRIPTION_MAX}
        </span>
      </SettingsRow>

      <h3 className="settings-section">Online</h3>
      {field('website', 'Website', { placeholder: 'yourshop.com' })}
      {field('instagram', 'Instagram', { placeholder: 'instagram.com/yourshop' })}
      {field('facebook', 'Facebook', { placeholder: 'facebook.com/yourshop' })}
      {field('tiktok', 'TikTok', { placeholder: 'tiktok.com/@yourshop' })}
      {field('etsy', 'Etsy', { placeholder: 'etsy.com/shop/yourshop' })}

      <SettingsRow label="">
        <button type="submit" className="button" disabled={!changed || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {justSaved && <span className="muted">Saved.</span>}
      </SettingsRow>
      {error && <p className="form-error settings-row__error">{error}</p>}
    </form>
  );
}

/** "Jinuo's Jewelry" -> "jinuos-jewelry": a suggested link name, shown as the placeholder. */
function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

/**
 * The public profile's link. Saving a link name turns the profile on; "Turn off" clears it.
 * Saved separately from the details above, since it decides whether any of them are public.
 */
function PublicProfileForm({ business }: { business: Business }) {
  const { updateBusiness } = useAuth();
  const saved = business.publicSlug ?? '';
  const [slug, setSlug] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Show what the server kept (it lowercases and trims), and clear the box after "Turn off".
  const [shownSaved, setShownSaved] = useState(saved);
  if (shownSaved !== saved) {
    setShownSaved(saved);
    setSlug(saved);
  }

  const path = saved ? `/p/${saved}` : null;
  const url = path ? `${window.location.origin}${path}` : null;

  async function save(publicSlug: string) {
    setSaving(true);
    setError(null);
    setCopied(false);
    try {
      await updateBusiness({ publicSlug });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Could not copy the link. Select it and copy it instead.');
    }
  }

  return (
    <form
      className="settings-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void save(slug.trim());
      }}
      noValidate
    >
      <h3 className="settings-section">Public profile</h3>
      <p className="muted">
        A page customers can visit without an account. It shows your logo, description, city and
        links above, and the inventory items you mark &quot;Show on my public profile&quot;. Your
        email, phone, street address and stock counts are never shown.
      </p>
      <SettingsRow label="Status">
        {url ? (
          <span className="public-link">
            On at <code>{url}</code>
          </span>
        ) : (
          <span className="muted">Off. Choose a link name to turn it on.</span>
        )}
      </SettingsRow>
      <SettingsRow label="Link name">
        <span className="public-link__prefix muted">/p/</span>
        <input
          className="settings-row__input settings-row__input--short"
          aria-label="Public link name"
          value={slug}
          placeholder={suggestSlug(business.name) || 'your-shop'}
          maxLength={40}
          onChange={(event) => {
            setSlug(event.target.value);
            setError(null);
          }}
        />
      </SettingsRow>
      <SettingsRow label="">
        <button
          type="submit"
          className="button"
          disabled={saving || slug.trim() === '' || slug.trim().toLowerCase() === saved}
        >
          {saving ? 'Saving…' : saved ? 'Change link' : 'Turn on'}
        </button>
        {path && (
          <>
            <Link to={path} target="_blank" rel="noopener" className="button button--secondary">
              View profile
            </Link>
            <button type="button" className="button button--secondary" onClick={copy}>
              Copy link
            </button>
            <button
              type="button"
              className="button button--ghost"
              disabled={saving}
              onClick={() => void save('')}
            >
              Turn off
            </button>
          </>
        )}
        {copied && <span className="muted">Copied.</span>}
      </SettingsRow>
      <p className="muted">3–40 characters: lowercase letters, numbers and hyphens.</p>
      {error && <p className="form-error settings-row__error">{error}</p>}
    </form>
  );
}

export function ProfileTab() {
  const { business, setAvatar, removeAvatar, setLogo, removeLogo } = useAuth();
  if (!business) return null;

  return (
    <>
      <h3 className="settings-section">Profile picture</h3>
      <PictureControl
        preview={
          <Avatar
            key={business.avatarUrl ?? 'initials'}
            name={business.name}
            imageUrl={business.avatarUrl}
          />
        }
        hasImage={!!business.avatarUrl}
        hint={
          business.avatarUrl
            ? 'Shown in the sidebar. Remove it to go back to your initials.'
            : 'No picture yet, so your initials are shown. Any photo works; it is cropped to a square.'
        }
        onPick={async (file) => setAvatar(await resizeToSquareJpeg(file))}
        onRemove={removeAvatar}
      />

      <h3 className="settings-section">Business logo</h3>
      <PictureControl
        preview={
          <div className="settings-logo">
            {business.logoUrl ? (
              <img key={business.logoUrl} src={business.logoUrl} alt="Business logo" />
            ) : (
              <span className="muted">No logo</span>
            )}
          </div>
        }
        hasImage={!!business.logoUrl}
        hint="Kept in its original shape, so a wide logo works. Transparent backgrounds are fine."
        onPick={async (file) => setLogo(await resizeToFit(file))}
        onRemove={removeLogo}
      />

      <DetailsForm key={business.id} business={business} />

      <PublicProfileForm key={`public-${business.id}`} business={business} />
    </>
  );
}
