import { z } from 'zod';
import { HttpError } from '../../utils/httpError.js';
import type { NamedEntry, NamedListRepository } from './namedLists.repository.js';

export interface NamedListOptions {
  /** Used in error messages: `Channel "Etsy" already exists`. */
  label: string;
  maxNameLength: number;
}

/** List every entry, or add one whose name isn't taken (ignoring case). */
export function createNamedListService(
  repository: NamedListRepository,
  { label, maxNameLength }: NamedListOptions,
) {
  const createSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(maxNameLength),
  });

  function list(): Promise<NamedEntry[]> {
    return repository.findAll();
  }

  /** Takes the raw request body; validates it here so each list keeps its own length limit. */
  async function create(body: unknown): Promise<NamedEntry> {
    const { name } = createSchema.parse(body);
    if (await repository.findByName(name)) {
      throw new HttpError(409, `${label} "${name}" already exists`);
    }
    return repository.insert(name);
  }

  return { list, create };
}

export type NamedListService = ReturnType<typeof createNamedListService>;
