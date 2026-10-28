import {
  playersAfterGreatestEmpire,
  playersAfterScore,
} from "game-logic/players.transitions";
import { useState } from "react";

export const initialPlayerStatus: PlayerStatus[] = [
  { player: "player", points: 0, greatestEmpirePoint: false },
  { player: "enemy1", points: 0, greatestEmpirePoint: false },
  { player: "enemy2", points: 0, greatestEmpirePoint: false },
  { player: "enemy3", points: 0, greatestEmpirePoint: false },
];

/**
 * plain react state + named update methods
 *
 * **no game logic here**
 */
export function usePlayers(initialPlayers = initialPlayerStatus) {
  const [players, setPlayers] = useState(initialPlayers);

  const reorderPlayers = (
    reorder: (currentPlayers: PlayerStatus[]) => PlayerStatus[]
  ) => {
    setPlayers(reorder);
  };

  const scorePoint = (player: PlayerType) => {
    setPlayers((currentPlayers) =>
      playersAfterScore({ players: currentPlayers, player })
    );
  };

  const declareGreatestEmpire = (player: PlayerType) => {
    setPlayers((currentPlayers) =>
      playersAfterGreatestEmpire({ players: currentPlayers, player })
    );
  };

  return {
    players,
    reorderPlayers,
    scorePoint,
    declareGreatestEmpire,
    _overridePlayers: setPlayers,
  };
}
