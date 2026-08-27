import { GameMap } from '../types';
import { WORLD_MAP } from './world.map';
import { SPAIN_MAP } from './spain.map';
import { SPAIN_REGIONS_MAP } from './spain-regions.map';
import { SPAIN_1936_MAP } from './spain-1936.map';

export const RISK_MAPS: GameMap[] = [WORLD_MAP, SPAIN_MAP, SPAIN_REGIONS_MAP, SPAIN_1936_MAP];

export function getMap(mapId: string): GameMap {
  const found = RISK_MAPS.find((map) => map.id === mapId);
  if (!found) throw new Error(`Mapa desconocido: ${mapId}`);
  return found;
}

export function mapExists(mapId: string): boolean {
  return RISK_MAPS.some((map) => map.id === mapId);
}
