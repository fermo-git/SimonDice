import type { Saved } from './services';

/** Identificador corto y único de un jugador (solo letras y números: sirve como parte del id de un documento). */
export const newPlayerId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * Id de los documentos de este jugador en Firestore (users y leaderboard).
 * Un teléfono (uid) puede tener varios jugadores, uno por apodo: `${uid}_${playerId}`.
 * Sin playerId (jugador anterior a esta función) se conserva el id de siempre: el uid solo.
 */
export const entryId = (uid: string, playerId: string) => (playerId ? `${uid}_${playerId}` : uid);

/** Qué hacer cuando el jugador escribe un apodo en la pantalla de inicio. */
export type NamePlan =
  | { action: 'ignore' }
  | { action: 'apply'; patch: Partial<Saved> & { name: string }; needsConfirm: boolean };

/**
 * Cambiar de apodo = jugador nuevo: récord y última partida en 0 y un playerId nuevo, así el jugador
 * anterior se conserva intacto en la nube (con su récord) y el nuevo se guarda aparte.
 *  - Vacío o igual al actual: no se cambia nada.
 *  - Solo cambian mayúsculas/minúsculas ("ana" → "Ana"): se corrige el nombre y es el MISMO jugador.
 *  - Nombre distinto: jugador nuevo. Pide confirmación solo si había progreso.
 */
export function planNameChange(saved: Pick<Saved, 'name' | 'best' | 'last'>, raw: string): NamePlan {
  const name = raw.trim();
  if (name === '' || name === saved.name) {
    return { action: 'ignore' };
  }
  if (name.toLowerCase() === saved.name.toLowerCase()) {
    return { action: 'apply', patch: { name }, needsConfirm: false };
  }
  const hasProgress = saved.best > 0 || saved.last !== null;
  return { action: 'apply', patch: { name, best: 0, last: null, playerId: newPlayerId() }, needsConfirm: hasProgress };
}
