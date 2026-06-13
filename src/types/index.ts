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
  coords: { lat: number; lon: number };
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
  collectedSpecialties: string[];
  isCompleted: boolean;
  playerLat: number;
  playerLon: number;
  lastPlayed: string;
}

export interface WorldMapSceneData {
  character: CharacterType;
}

export interface PortSceneData {
  port: Port;
  character: CharacterType;
  collectedSpecialties: string[];
}

export interface LogbookSceneData {
  discoveredPorts: string[];
  collectedSpecialties: string[];
  character: CharacterType;
}

export interface VictorySceneData {
  character: CharacterType;
  totalTime: number;
}
