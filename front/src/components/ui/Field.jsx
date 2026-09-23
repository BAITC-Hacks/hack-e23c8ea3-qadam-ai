export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-stone-500">{label}{hint}</span>
      {children}
    </label>
  )
}
