/** Legitimately shared between client and server. Carries no sentinel. */
export const formatName = (first: string, last: string): string => `${last}, ${first}`;
