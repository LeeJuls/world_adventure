export interface Specialty {
  icon: string;
  nameKo: string;
  nameEn: string;
  descKo: string;
}

export interface Landmark {
  nameKo: string;
  nameEn: string;
  descKo: string;
}

export interface Port {
  id: string;
  nameKo: string;
  nameEn: string;
  countryKo: string;
  countryEn: string;
  region: 'asia' | 'europe' | 'africa' | 'americas' | 'oceania' | 'middleeast';
  coords: { x: number; y: number };
  specialties: Specialty[];
  landmark: Landmark;
  funFact: string;
}

export interface PortsData {
  version: string;
  total: number;
  ports: Port[];
}

export type CharacterType = 'jun' | 'ara';

export interface GameState {
  character: CharacterType | null;
  discoveredPorts: string[];
  playerX: number;
  playerY: number;
  lastPlayed: string;
}

export interface WorldMapSceneData {
  character: CharacterType;
}

export interface PortSceneData {
  port: Port;
  character: CharacterType;
}

export interface LogbookSceneData {
  discoveredPorts: string[];
  character: CharacterType;
}
