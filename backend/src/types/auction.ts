// Tipi dell'asta (reframe fisico-digitale): le offerte sono cartacee, l'app è
// tabellone + arbitro + memoria. Lo stato vive come blob JSON in auction_sessions.

export type Slot = 'motore' | 'sponsor' | 'pilota1' | 'benzina' | 'telaio' | 'pilota2';
export type ComponentKind = 'telaio' | 'motore' | 'pilota' | 'sponsor' | 'benzina';

// Ordine fasi d'asta (regolamento).
export const PHASE_ORDER: Slot[] = ['motore', 'sponsor', 'pilota1', 'benzina', 'telaio', 'pilota2'];

export function slotToKind(slot: Slot): ComponentKind {
  return slot === 'pilota1' || slot === 'pilota2' ? 'pilota' : slot;
}

// Slot in conflitto di scuderia (no Telaio+Motore stessa scuderia; no (Telaio|Motore)+Pilota stessa scuderia).
export function conflictSlots(slot: Slot): Slot[] {
  if (slot === 'telaio') return ['motore', 'pilota1', 'pilota2'];
  if (slot === 'motore') return ['telaio', 'pilota1', 'pilota2'];
  if (slot === 'pilota1' || slot === 'pilota2') return ['telaio', 'motore'];
  return []; // sponsor, benzina: nessun vincolo
}

export interface AuctionComponent {
  id: string;
  kind: ComponentKind;
  name: string;
  basePrice: number;
  scuderiaId: string | null; // fia_team_id (per un pilota = fia_team del driver) — per i vincoli
  assignedTo: string | null; // teamId del vincitore
}

export interface AuctionParticipant {
  teamId: string;
  personName: string;
  teamName: string;
  budget: number; // residuo
  garage: Partial<Record<Slot, string>>; // slot → componentId
}

export interface Slip {
  teamId: string;
  componentId: string;
  amount: number;
}

export interface PendingTiebreak {
  componentId: string;
  teamIds: string[];
  amount: number;
}

export interface RoundAssignment {
  teamId: string;
  componentId: string;
  componentName: string;
  amount: number;
}

export interface HistoryEntry {
  slot: Slot;
  componentId: string;
  componentName: string;
  winnerTeamId: string;
  amount: number;
  bids: { teamId: string; amount: number }[];
}

export interface AuctionRound {
  slot: Slot;
  roundNumber: number;
  activeTeamIds: string[]; // chi deve ancora prendere questo slot in questo (sub)round
  availableComponentIds: string[];
  slips: Slip[]; // biglietti letti e registrati
  mode: 'bidding' | 'tiebreak';
  tieComponentId: string | null;
  tieTeamIds: string[];
  pendingTiebreaks: PendingTiebreak[];
  assignments: RoundAssignment[]; // assegnazioni maturate in questo round
}

export interface AuctionState {
  seasonId: string;
  status: 'lobby' | 'category' | 'done';
  budgetInitial: number;
  participants: AuctionParticipant[];
  components: AuctionComponent[];
  round: AuctionRound | null;
  history: HistoryEntry[];
  lastAssignments: RoundAssignment[]; // ultimi pezzi incastrati (per l'animazione snap sul tabellone)
}
