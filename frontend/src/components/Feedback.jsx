import { CircleAlert, Inbox, LoaderCircle } from "lucide-react";
export function Loading({ text = "Loading…" }) {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={24} />
      <p>{text}</p>
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="notice error" role="alert">
      <CircleAlert size={22} />
      <div>
        <strong>We couldn’t load this information</strong>
        <p>{error?.message || "Please try again."}</p>
        {retry && (
          <button className="button secondary small" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = "No reports to show",
  text = "New community reports will appear here.",
  children,
}) {
  return (
    <div className="state empty">
      <Inbox size={30} strokeWidth={1.5} />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function FieldError({ children }) {
  return children ? (
    <p className="field-error" role="alert">
      {children}
    </p>
  ) : null;
}
