/**
 * The 9 San Isidro barangays, matching the `barangays` table seed data
 * (barangay_id 1-9). Static reference data — not worth a network round-trip
 * to fetch, so it's kept here as the single source of truth and imported
 * wherever a barangay picker is needed (registration, admin broadcast
 * targeting), instead of being duplicated per-component.
 */
export interface Barangay {
  id: number;
  name: string;
}

export const BARANGAYS: readonly Barangay[] = [
  { id: 1, name: 'Alua' },
  { id: 2, name: 'Calaba' },
  { id: 3, name: 'Malapit' },
  { id: 4, name: 'Mangga' },
  { id: 5, name: 'Poblacion' },
  { id: 6, name: 'Pulo' },
  { id: 7, name: 'San Roque' },
  { id: 8, name: 'Santo Cristo' },
  { id: 9, name: 'Tabon' },
];
