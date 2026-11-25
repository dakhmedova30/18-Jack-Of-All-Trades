import { LegalLayout } from './LegalLayout';

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy">
      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account:</strong> business name, email address, and your password (stored
          only as a one-way hash, never in plain text).
        </li>
        <li>
          <strong>Your business data:</strong> inventory, sales, expenses, sales channels, tags, and
          anything you add in Settings, including an optional profile picture, logo, owner name,
          contact details and links.
        </li>
        <li>
          <strong>Login activity:</strong> when you log in, and the browser's description (its
          user-agent text), so you can see where you're logged in and spot a login you don't
          recognise. We don't store IP addresses.
        </li>
      </ul>

      <h2>Cookies and browser storage</h2>
      <p>
        A session cookie keeps you logged in. Your display choices (theme, text size, date format,
        rows per page, dismissed alerts) are saved in your browser's own storage and never sent to
        us.
      </p>

      <h2>How it is used</h2>
      <p>
        Your data is used only to run the app for you: showing your records, totals and alerts. We
        don't sell it.
      </p>

      <h2>Your choices</h2>
      <p>
        You can edit your details in Settings, log out other devices, and permanently delete your
        account and everything in it under Settings → Security.
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, the date above will change with it.</p>
    </LegalLayout>
  );
}
