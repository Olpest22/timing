export function Spinner() {
  return (
    <div className="flex justify-center py-20" role="status" aria-label="Загрузка">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" />
    </div>
  );
}
