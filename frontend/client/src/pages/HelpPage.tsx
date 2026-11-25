import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Set VITE_SUPPORT_EMAIL (e.g. in client/.env) to show a "Contact support" line; leave it out to hide it. */
const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim();

interface Topic {
  question: string;
  answer: ReactNode;
}

const TOPICS: Topic[] = [
  {
    question: 'How do I record a sale?',
    answer: (
      <>
        Go to <Link to="/sales">Sales</Link> and choose <strong>Add sale</strong>. Pick the date and
        channel, then add the items sold. Stock for those items goes down automatically.
      </>
    ),
  },
  {
    question: 'How do I add or restock inventory?',
    answer: (
      <>
        Add new items on <Link to="/inventory">Inventory</Link>. To restock, record the purchase as
        an expense on <Link to="/expenses">Expenses</Link> and pick the item on a line, so its stock
        goes up.
      </>
    ),
  },
  {
    question: 'How do I add an expense?',
    answer: (
      <>
        On <Link to="/expenses">Expenses</Link>, choose <strong>Add expense</strong>. Each line is
        either a restock of an item or a plain cost, such as rent or shipping.
      </>
    ),
  },
  {
    question: 'Can I change my sales channels or expense tags?',
    answer: (
      <>
        Yes. Open <Link to="/settings/preferences">Settings → Preferences</Link> to add, rename or
        delete channels and tags. Inventory tags can be renamed or removed there too.
      </>
    ),
  },
  {
    question: 'What counts as "low stock"?',
    answer: (
      <>
        Items with the number you choose, or fewer, in stock. The default is 5. Change it under{' '}
        <Link to="/settings/preferences">Settings → Preferences</Link> or{' '}
        <Link to="/settings/notifications">Notifications</Link>.
      </>
    ),
  },
  {
    question: 'What is the bell at the top of the sidebar?',
    answer: (
      <>
        It lists alerts such as low stock, no recent sales and an unusual jump in expenses. Choose
        which ones you want, and the numbers that trigger them, under{' '}
        <Link to="/settings/notifications">Settings → Notifications</Link>.
      </>
    ),
  },
  {
    question: 'How do I change my password or email?',
    answer: (
      <>
        Your email is under <Link to="/settings/account">Settings → Account</Link>, and your
        password is under <Link to="/settings/security">Security</Link>, where you can also log out
        other devices.
      </>
    ),
  },
  {
    question: 'How do I delete my account?',
    answer: (
      <>
        At the bottom of <Link to="/settings/security">Settings → Security</Link>. This permanently
        deletes the business and all its data, and can't be undone.
      </>
    ),
  },
];

/** Short answers to common questions, written from what the app actually does. */
export function HelpPage() {
  return (
    <section className="page help-page">
      <h1>Help and Support</h1>
      <div className="help-list">
        {TOPICS.map((topic) => (
          <details key={topic.question} className="help-item card">
            <summary>{topic.question}</summary>
            <p>{topic.answer}</p>
          </details>
        ))}
      </div>
      <p className="muted">
        {SUPPORT_EMAIL ? (
          <>
            Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </>
        ) : (
          'Still stuck? Ask the person who set up this app for you.'
        )}
      </p>
    </section>
  );
}
