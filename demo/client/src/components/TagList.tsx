export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="muted">—</span>;
  return (
    <ul className="tag-list">
      {tags.map((tag) => (
        <li key={tag} className="tag">
          {tag}
        </li>
      ))}
    </ul>
  );
}
