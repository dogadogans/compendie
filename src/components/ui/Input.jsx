export function Input({ label, as: Tag = "input", className = "", ...props }) {
  return (
    <div className="ui-field">
      {label && <label className="ui-field-label">{label}</label>}
      <Tag className={`ui-input ${className}`} {...props} />
    </div>
  );
}
