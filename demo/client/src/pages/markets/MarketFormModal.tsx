import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import type { CurrencyRates, Market, MarketInput } from '../../types';
import { centsToInputValue, MAX_AMOUNT_CENTS, parseDollarsToCents } from '../../utils/money';

type DateState = { startsAt: string; endsAt: string };
type PlaceOption = { label: string; latitude: number; longitude: number };
type PhotonResponse = {
  features?: {
    geometry: { coordinates: [number, number] };
    properties: {
      name?: string;
      housenumber?: string;
      street?: string;
      postcode?: string;
      city?: string;
      state?: string;
      country?: string;
    };
  }[];
};

function localDateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function dateState(market?: Market): DateState[] {
  if (!market || market.dates.length === 0)
    return [{ startsAt: localDateTime(), endsAt: localDateTime() }];
  return market.dates.map((date) => ({
    startsAt: localDateTime(date.startsAt),
    endsAt: localDateTime(date.endsAt),
  }));
}

interface MarketFormModalProps {
  market?: Market;
  currencies: CurrencyRates;
  onCancel: () => void;
  onSubmit: (input: MarketInput) => Promise<void>;
}

export function MarketFormModal({ market, currencies, onCancel, onSubmit }: MarketFormModalProps) {
  const [name, setName] = useState(market?.name ?? '');
  const [location, setLocation] = useState(market?.location ?? '');
  const [locationQuery, setLocationQuery] = useState(market?.location ?? '');
  const [locationLatitude, setLocationLatitude] = useState<number | null>(market?.locationLatitude ?? null);
  const [locationLongitude, setLocationLongitude] = useState<number | null>(market?.locationLongitude ?? null);
  const [searchLocation, setSearchLocation] = useState(false);
  const [placeOptions, setPlaceOptions] = useState<PlaceOption[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [currency, setCurrency] = useState(market?.currency ?? 'CAD');
  const [tableFee, setTableFee] = useState(centsToInputValue(market?.tableFeeCents ?? 0));
  const [expenses, setExpenses] = useState(centsToInputValue(market?.extraExpensesCents ?? 0));
  const [attending, setAttending] = useState(market?.attending ?? false);
  const [status, setStatus] = useState<MarketInput['status']>(market?.status ?? 'planned');
  const [dates, setDates] = useState<DateState[]>(() => dateState(market));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!searchLocation || locationLatitude !== null || locationQuery.trim().length < 3) {
      setPlaceOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPlaceLoading(true);
      setPlaceError(null);
      try {
        const url = new URL('https://photon.komoot.io/api/');
        url.searchParams.set('q', locationQuery.trim());
        url.searchParams.set('limit', '5');
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Place search failed (${response.status}).`);
        const data = await response.json() as PhotonResponse;
        const options = (data.features ?? []).flatMap((feature) => {
          const [longitude, latitude] = feature.geometry.coordinates;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
          const properties = feature.properties;
          const street = [properties.housenumber, properties.street].filter(Boolean).join(' ');
          const label = [
            properties.name,
            street,
            properties.postcode,
            properties.city,
            properties.state,
            properties.country,
          ].filter(Boolean).join(', ');
          return label ? [{ label, latitude, longitude }] : [];
        });
        setPlaceOptions(options);
      } catch (reason) {
        if (!controller.signal.aborted)
          setPlaceError(reason instanceof Error ? reason.message : 'Could not search for places.');
      } finally {
        if (!controller.signal.aborted) setPlaceLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locationLatitude, locationQuery, searchLocation]);

  function updateDate(index: number, field: keyof DateState, value: string) {
    setDates((current) =>
      current.map((date, dateIndex) => (dateIndex === index ? { ...date, [field]: value } : date)),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const tableFeeCents = parseDollarsToCents(tableFee);
    const extraExpensesCents = parseDollarsToCents(expenses);
    if (!name.trim()) return setError('Enter the market name.');
    if (location.trim() && (locationLatitude === null || locationLongitude === null))
      return setError('Choose a location from the map search results, or clear the location.');
    if (tableFeeCents === null || tableFeeCents < 0 || tableFeeCents > MAX_AMOUNT_CENTS)
      return setError('Enter a valid table fee.');
    if (extraExpensesCents === null || extraExpensesCents < 0 || extraExpensesCents > MAX_AMOUNT_CENTS)
      return setError('Enter valid extra expenses.');
    const dateValues = dates.map((date) => ({
      start: new Date(date.startsAt),
      end: new Date(date.endsAt),
    }));
    if (dateValues.some((date) => !Number.isFinite(date.start.getTime()) || !Number.isFinite(date.end.getTime())))
      return setError('Enter a start and end date for every market day.');
    if (dateValues.some((date) => date.end < date.start))
      return setError('A market day cannot end before it starts.');
    const parsedDates = dateValues.map((date) => ({
      startsAt: date.start.toISOString(),
      endsAt: date.end.toISOString(),
    }));

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        location: location.trim(),
        locationLatitude,
        locationLongitude,
        currency,
        tableFeeCents,
        extraExpensesCents,
        attending,
        status,
        dates: parsedDates,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this market.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={market ? 'Edit market' : 'Add market'}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" form="market-form" className="button" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save market'}
          </button>
        </>
      }
    >
      <form id="market-form" className="item-form" onSubmit={handleSubmit} noValidate>
        <label>
          Market name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
        </label>
        <label>
          Search for a location
          <input
            value={locationQuery}
            onFocus={() => setSearchLocation(true)}
            onChange={(event) => {
              const value = event.target.value;
              setLocationQuery(value);
              setLocation(value);
              setLocationLatitude(null);
              setLocationLongitude(null);
              setSearchLocation(true);
            }}
            maxLength={300}
            placeholder="Search venue, address, or city"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={placeOptions.length > 0}
            aria-controls="market-location-options"
          />
          {placeLoading && <span className="muted">Searching locations…</span>}
          {placeError && <span className="form-error" role="alert">{placeError}</span>}
          {placeOptions.length > 0 && (
            <div className="market-location__options" id="market-location-options" role="listbox" aria-label="Location search results">
              {placeOptions.map((option) => (
                <button
                  type="button"
                  className="market-location__option"
                  role="option"
                  aria-selected="false"
                  key={`${option.latitude},${option.longitude}`}
                  onClick={() => {
                    setLocation(option.label);
                    setLocationQuery(option.label);
                    setLocationLatitude(option.latitude);
                    setLocationLongitude(option.longitude);
                    setSearchLocation(false);
                    setPlaceOptions([]);
                    setPlaceError(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <span className="muted">Location search by OpenStreetMap contributors (Photon).</span>
        </label>
        {location && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              locationLatitude !== null && locationLongitude !== null
                ? `${locationLatitude},${locationLongitude}`
                : location,
            )}`}
            target="_blank"
            rel="noreferrer"
          >
            Preview selected location in Google Maps
          </a>
        )}
        <div className="market-form__grid">
          <label>
            Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} disabled={!!market && market.saleCount > 0}>
              {currencies.currencies.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} — {option.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Table fee ({currency})
            <input inputMode="decimal" value={tableFee} onChange={(event) => setTableFee(event.target.value)} />
          </label>
          <label>
            Other expenses ({currency})
            <input inputMode="decimal" value={expenses} onChange={(event) => setExpenses(event.target.value)} />
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as MarketInput['status'])}>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
        {market && market.saleCount > 0 && (
          <p className="muted">Currency is locked after a sale has been recorded so historical prices remain consistent.</p>
        )}
        <label className="item-form__check">
          <input type="checkbox" checked={attending} onChange={(event) => setAttending(event.target.checked)} />
          I am attending this market
        </label>

        <fieldset className="market-form__dates">
          <legend>Market dates and times</legend>
          {dates.map((date, index) => (
            <div className="market-form__date" key={index}>
              <label>
                Start
                <input
                  type="datetime-local"
                  value={date.startsAt}
                  onChange={(event) => updateDate(index, 'startsAt', event.target.value)}
                  required
                />
              </label>
              <label>
                End
                <input
                  type="datetime-local"
                  value={date.endsAt}
                  onChange={(event) => updateDate(index, 'endsAt', event.target.value)}
                  required
                />
              </label>
              {dates.length > 1 && (
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setDates((current) => current.filter((_, dateIndex) => dateIndex !== index))}
                  aria-label={`Remove market date ${index + 1}`}
                >
                  Remove day
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setDates((current) => [...current, { startsAt: localDateTime(), endsAt: localDateTime() }])}
          >
            Add another day
          </button>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
