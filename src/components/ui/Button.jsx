export function Button({ variant = "secondary", size = "sm", className = "", children, ...props }) {
  return (
    <button
      className={`ui-btn ui-btn--${size} ui-btn--${variant}${className ? ` ${className}` : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
