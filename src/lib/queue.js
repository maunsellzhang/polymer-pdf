/** Keep reordering bounded and leave the input array untouched. */
export function moveEntry(entries, id, offset) {
  const index = entries.findIndex((entry) => entry.id === id)
  const target = index + offset
  if (index < 0 || target < 0 || target >= entries.length) return entries
  const reordered = [...entries]
  const [entry] = reordered.splice(index, 1)
  reordered.splice(target, 0, entry)
  return reordered
}
