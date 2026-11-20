import { useAuth } from './useAuth';

/** The currency selected in the business details settings. */
export function useCurrency(): string {
  const { business } = useAuth();
  return business?.currency ?? 'CAD';
}
