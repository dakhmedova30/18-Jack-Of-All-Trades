/** Stands in for a page that's on the sidebar but not built yet. */
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <section className="page">
      <div>
        <h1>{title}</h1>
        <p className="muted">This page is being built.</p>
      </div>
    </section>
  );
}
