import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
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
  'name' | 'businessType' | 'country' | 'timeZone' | 'currency' | 'lowStockThreshold'
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
    </>
  );
}
