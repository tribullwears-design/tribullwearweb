/** Refreshes the Admin Users list only after the server confirms the save. */
export async function saveAdminUserAndRefresh<T>(save: () => Promise<T>, refresh: () => Promise<void>): Promise<T> {
  const saved = await save();
  await refresh();
  return saved;
}
