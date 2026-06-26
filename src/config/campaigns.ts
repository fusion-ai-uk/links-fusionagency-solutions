export interface CampaignOption {
  id: string;
  label: string;
}

/**
 * Known campaign waves shown in the admin filter even before data arrives.
 * Keep IDs in sync with the cid values used in email HTML.
 */
export const KNOWN_CAMPAIGNS: CampaignOption[] = [
  { id: "imi-lyvdelzi-may-2026", label: "Lyvdelzi May 2026" },
  { id: "imi-aids2026-pre-email-jun-2026", label: "AIDS 2026 Pre-email (Jun 2026)" },
  { id: "imi-aids2026-post-congress-jul-2026", label: "AIDS 2026 Post-congress (Jul 2026)" },
  { id: "imi-aids2026-wave-3", label: "AIDS 2026 Wave 3 (placeholder)" },
];

export function getCampaignOptions(existingCampaignIds: string[]): CampaignOption[] {
  const knownById = new Map(KNOWN_CAMPAIGNS.map((c) => [c.id, c]));
  const merged = [...KNOWN_CAMPAIGNS];

  for (const id of existingCampaignIds) {
    if (!knownById.has(id)) {
      merged.push({ id, label: id });
    }
  }

  return merged;
}
