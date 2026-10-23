/** Same format as the server's default description, so the field shows what will be saved. */
export function describeLines(lines: { itemName: string; quantity: number }[]): string {
  return lines.map((line) => `${line.itemName} x ${line.quantity}`).join(', ');
}
