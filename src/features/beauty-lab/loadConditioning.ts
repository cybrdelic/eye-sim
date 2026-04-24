import conditioningPayloadUrl from '@/data/conditioning/facecapConditioning.json?url';
import type { FacecapConditioningData } from './types';

let conditioningPromise: Promise<FacecapConditioningData> | null = null;

export function loadFacecapConditioning() {
  if (!conditioningPromise) {
    conditioningPromise = fetch(conditioningPayloadUrl).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Unable to load conditioning payload (${response.status})`);
      }

      return response.json() as Promise<FacecapConditioningData>;
    });
  }

  return conditioningPromise;
}
