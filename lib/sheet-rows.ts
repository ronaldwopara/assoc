/**
 * A row with nothing in it but ticked/unticked boxes isn't a person. Tick-box
 * columns (e.g. Stop Reminders) read back "TRUE"/"FALSE" on every row they
 * cover, so without this a sheet's empty rows all count.
 */
export function rowHasContent(row: string[]): boolean {
  return row.some((cell) => {
    const v = String(cell ?? "").trim();
    return v !== "" && !/^(true|false)$/i.test(v);
  });
}
