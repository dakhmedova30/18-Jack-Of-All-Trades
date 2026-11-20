import { LegalLayout } from './LegalLayout';

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Use">
      <h2>Using the app</h2>
      <p>
        Jack-Of-All-Trades helps a small business keep track of inventory, sales and expenses. By
        creating an account you agree to use it for that purpose and to follow these terms.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for keeping your password private and for what happens under your
        account. Tell us if you think someone else has access. You can log out other devices, change
        your password, or delete your account at any time from Settings.
      </p>

      <h2>Your data</h2>
      <p>
        The inventory, sales, expenses and other information you enter belongs to you. We store it
        so the app can show it back to you. Deleting your account permanently deletes it.
      </p>

      <h2>Accuracy and advice</h2>
      <p>
        The totals, charts and alerts are only as accurate as what you enter. The app is a
        record-keeping aid. It is not accounting, tax or legal advice, so check important figures
        before relying on them.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don't try to break into other accounts, overload the service, or use it to store anything
        unlawful.
      </p>

      <h2>Availability and changes</h2>
      <p>
        The app is provided as is, and may be unavailable or change from time to time. We may update
        these terms, and the date above will change when we do.
      </p>
    </LegalLayout>
  );
}
