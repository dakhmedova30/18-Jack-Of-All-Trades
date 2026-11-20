interface DescriptionRowProps {
  id: string;
  /** The user's own text, or null to follow `autoDescription`. */
  customDescription: string | null;
  onChange: (customDescription: string | null) => void;
  /** Built from the form's lines ("Flower Print x 2"); shown until the user types. */
  autoDescription: string;
  placeholder: string;
}

/** A Description form row that fills itself in from the lines until the user edits it. */
export function DescriptionRow({
  id,
  customDescription,
  onChange,
  autoDescription,
  placeholder,
}: DescriptionRowProps) {
  return (
    <div className="form-row">
      <label htmlFor={id}>Description</label>
      <div className="form-row__control">
        <input
          id={id}
          value={customDescription ?? autoDescription}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={200}
        />
        {customDescription !== null && (
          <button
            type="button"
            className="link-button form-row__reset"
            onClick={() => onChange(null)}
          >
            Use item names
          </button>
        )}
      </div>
    </div>
  );
}
