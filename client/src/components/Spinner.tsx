export function Spinner() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Загрузка">
      <span className="ui-spinner text-on-canvas-muted" />
    </div>
  );
}
