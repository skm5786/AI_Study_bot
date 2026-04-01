export default function Alert({ type = "info", message }) {
  if (!message) return null;

  const styles = {
    info: "border-border bg-panel text-text",
    success: "border-accent/60 bg-accent/10 text-text",
    error: "border-danger/60 bg-danger/10 text-text"
  };

  return (
    <div className={`rounded-lg border p-3 text-sm ${styles[type] || styles.info}`}>
      {message}
    </div>
  );
}
