/**
 * The default sale/expense description: "Flower Print x 2, Keychain x 1".
 * Cut to fit the 200-character description limit.
 */
export function describeLines(lines: { itemName: string; quantity: number }[]): string {
  const text = lines.map((line) => `${line.itemName} x ${line.quantity}`).join(', ');
  return text.length <= 200 ? text : `${text.slice(0, 199)}…`;
}
