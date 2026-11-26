/**
 * The characters an item tag may use: letters and numbers in any language, spaces, and
 * & - _ / # : ' ’ . + % ( ) !. Never a comma, which the item form uses to separate tags.
 * The backend's ItemInput.TAG_CHARACTERS is the same rule.
 */
const ITEM_TAG_CHARACTERS = /^[\p{L}\p{M}\p{N} &_/#:'’.+%()!-]*$/u;

export const ITEM_TAG_CHARACTERS_MESSAGE =
  "Tags can only use letters, numbers, spaces and & - _ / # : ' . + % ( ) !";

export function hasOnlyItemTagCharacters(tag: string): boolean {
  return ITEM_TAG_CHARACTERS.test(tag);
}
