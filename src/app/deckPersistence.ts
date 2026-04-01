import type { DeckData, DeckMeta } from './slideLoader';

const DEV_API = '/__deck';

export async function pingDeckDevApi(): Promise<boolean> {
  try {
    const res = await fetch(`${DEV_API}/ping`, { method: 'GET' });
    return res.status === 204;
  } catch {
    return false;
  }
}

export async function fetchDeckFromDevApi(deckId: string): Promise<DeckData | null> {
  try {
    const res = await fetch(`${DEV_API}/deck/${encodeURIComponent(deckId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { deck?: DeckData };
    return data.deck ?? null;
  } catch {
    return null;
  }
}

export async function saveDeckFile(
  deckId: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const res = await fetch(`${DEV_API}/save-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckId, relativePath, content }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Save failed (${res.status})`);
  }
}

export async function saveDeckMetadataToDisk(deckId: string, meta: DeckMeta): Promise<DeckData | null> {
  const res = await fetch(`${DEV_API}/save-metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckId, meta }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Save metadata failed (${res.status})`);
  }
  const data = (await res.json()) as { deck?: DeckData };
  return data.deck ?? null;
}

export async function createSlideAfterDeck(deckId: string, afterSlideId: string): Promise<DeckData> {
  const res = await fetch(`${DEV_API}/create-slide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckId, afterSlideId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Create slide failed (${res.status})`);
  }
  const data = (await res.json()) as { deck?: DeckData };
  if (!data.deck) throw new Error('No deck in response');
  return data.deck;
}

export async function createWorkingAreaOnDisk(deckId: string, slideId: string): Promise<DeckData> {
  const res = await fetch(`${DEV_API}/create-working-area`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckId, slideId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Create working area failed (${res.status})`);
  }
  const data = (await res.json()) as { deck?: DeckData };
  if (!data.deck) throw new Error('No deck in response');
  return data.deck;
}

export function relativePathForSlideFile(slideId: string, type: 'md' | 'html'): string {
  return `${slideId}/slide.${type === 'md' ? 'md' : 'html'}`;
}

export function relativePathForWorkingAreaFile(slideId: string, type: 'md' | 'html'): string {
  return `${slideId}/working-area/slide.${type === 'md' ? 'md' : 'html'}`;
}

export function relativePathForSpeakerNotes(slideId: string): string {
  return `${slideId}/speaker.md`;
}
