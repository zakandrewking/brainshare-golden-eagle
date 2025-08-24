/**
 * Replace the whole object if it exists; otherwise append
 * @param list - The list of items to update
 * @param item - The item to update
 * @returns The updated list
 */
export function upsertReplace<T extends { id: string }>(
  list: readonly T[],
  item: T
): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  return i === -1
    ? [...list, item]
    : [...list.slice(0, i), item, ...list.slice(i + 1)];
}
