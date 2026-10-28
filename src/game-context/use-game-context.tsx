import { createRandom } from "lib/random";
import type { Random } from "lib/random";
import {
  activePlayer as findActivePlayer,
  isPlanningComplete,
} from "game-logic/active-player";
import { boardAfterBuild, boardAfterMove } from "game-logic/board.transitions";
import { empireSize } from "game-logic/empire-size";
import { findWinner, isConqueringLastSettlement } from "game-logic/game-over";
import { randomizeFirstPlayer, rotateToFirst } from "game-logic/player-order";
import { greatestEmpireTaker, isConquering } from "game-logic/score-check";
import {
  playersAfterGreatestEmpire,
  playersAfterScore,
} from "game-logic/players.transitions";
import { isAttackingWalls } from "game-logic/walls";
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { logRender, warnInconsistentState } from "lib/console";
import { emptyBoard } from "./empty-board";
import { initialBoard } from "./initial-board";
import { useBoard } from "./use-board";
import { initialPlayerStatus, usePlayers } from "./use-players";
import { initialTimeline, useTimeline } from "./use-timeline";

const GameContext = createContext<GameContext>({
  ...initialTimeline,
  activePlayer: undefined,
  board: emptyBoard,
  players: [],
  build: () => {},
  move: () => {},
  recruit: () => {},
  skip: () => {},
  plan: () => {},
  submitPlanification: () => {},
  firstPlayer: () => {},
  newGame: () => {},
  loadSavegame: () => {},
});

type Props = { children: ReactNode; random?: Pick<Random, "int"> };

/**
 * GameController
 *
 * game state
 *
 * ```
 * { useTimeline(), useBoard(), usePlayers() }
 * ```
 */
export function GameContextProvider({ children, random }: Props) {
  logRender("GameContextProvider");

  const [gameRandom] = useState(
    () => random ?? createRandom(Math.floor(Math.random() * 2 ** 32))
  );
  const [startingPlayers] = useState(() =>
    randomizeFirstPlayer({ players: initialPlayerStatus, random: gameRandom })
  );

  const {
    board,
    buildOnTile,
    movePiece,
    destroyWalls,
    recruitOnTile,
    _overrideBoard,
  } = useBoard();

  const timeline = useTimeline();

  const {
    players,
    reorderPlayers,
    scorePoint,
    declareGreatestEmpire,
    _overridePlayers,
  } = usePlayers(startingPlayers);

  /* derived state */
  const activePlayer = findActivePlayer({
    activeCard: timeline.activeCard,
    phase: timeline.phase,
    next: timeline.next,
    players,
  });

  /* API */

  const loadSavegame = ({
    phase,
    winner,
    activeCard,
    next,
    future,
    board,
    players,
  }: GameState) => {
    _overrideBoard(board);
    timeline._overrideTimeline({ phase, winner, activeCard, next, future });
    _overridePlayers(players);
  };

  const newGame = () => {
    console.info("newGame()");
    _overrideBoard(initialBoard);
    timeline._overrideTimeline(initialTimeline);
    _overridePlayers(
      randomizeFirstPlayer({ players: initialPlayerStatus, random: gameRandom })
    );
  };

  /* `players`: the statuses once this action's points are scored */
  const _resolveActionCard = ({
    players,
    conqueror,
  }: {
    players: PlayerStatus[];
    conqueror?: PlayerType;
  }) => {
    const winner = findWinner({ players, conqueror });
    if (winner) {
      console.info(`resolveActionCard(): ${winner} wins, game over`);
      timeline.endGame(winner);
    } else if (timeline.next.length === 0) {
      console.info("resolveActionCard(): no more cards, changing phase");
      timeline.startPlanningPhase();
    } else {
      console.info("resolveActionCard(): next card");
      timeline.nextActiveCard();
    }
  };

  /* re-checked after every change to who owns which settlement */
  const _moveGreatestEmpire = ({
    board,
    players,
  }: {
    board: Board;
    players: PlayerStatus[];
  }) => {
    const taker = greatestEmpireTaker({ board, players });
    if (!taker) {
      return players;
    }
    console.info(`Score: ${taker} takes the rotating victory point`);
    declareGreatestEmpire(taker);
    return playersAfterGreatestEmpire({ players, player: taker });
  };

  const build = (action: { tile: TileID; building: Building }) => {
    if (timeline.phase !== "action") {
      return warnInconsistentState(
        `trying to build but not in "action" phase`,
        { phase: timeline.phase, action }
      );
    }
    console.info("buildOnTile()", action);
    buildOnTile(action);
    _resolveActionCard({
      players: _moveGreatestEmpire({
        board: boardAfterBuild({ board, ...action }),
        players,
      }),
    });
  };

  const move = (action: { piece: Piece; from: TileID; to: TileID }) => {
    if (timeline.phase !== "action") {
      return warnInconsistentState(`trying to move but not in "action" phase`, {
        phase: timeline.phase,
        action,
      });
    }
    const player = action.piece.owner;
    const targetTile = board[action.to];
    if (isAttackingWalls({ player, targetTile })) {
      console.info("destroyWalls()", action);
      destroyWalls(action.to);
      _resolveActionCard({ players });
      return;
    }
    console.info("movePiece()", action);
    const conquers = isConquering({ player, targetTile });
    if (conquers) {
      console.info(`Score: ${player} is conquering a settlement`);
      scorePoint(player);
    }
    const conquersLastSettlement = isConqueringLastSettlement({
      player,
      targetTile,
      empires: empireSize({ board, players }),
    });
    if (conquersLastSettlement) {
      console.info(
        `Game over: ${player} is conquering ${targetTile.building?.owner}'s last settlement`
      );
    }
    movePiece(action);
    _resolveActionCard({
      players: _moveGreatestEmpire({
        board: boardAfterMove({ board, ...action }),
        players: conquers ? playersAfterScore({ players, player }) : players,
      }),
      conqueror: conquersLastSettlement ? player : undefined,
    });
  };

  const recruit = (action: { tile: TileID; piece: Piece }) => {
    if (timeline.phase !== "action") {
      return warnInconsistentState(
        `trying to recruit but not in "action" phase`,
        { phase: timeline.phase, action }
      );
    }
    console.info("recruitOnTile()", action);
    recruitOnTile(action);
    _resolveActionCard({ players });
  };

  const firstPlayer = (player: PlayerType) => {
    if (timeline.phase !== "action") {
      return warnInconsistentState(
        `trying to take the first player but not in "action" phase`,
        { phase: timeline.phase, player }
      );
    }
    console.info("firstPlayer()", player);
    reorderPlayers((currentPlayers) =>
      rotateToFirst({ players: currentPlayers, first: player })
    );
    _resolveActionCard({ players });
  };

  const plan = (actions: Actions) => {
    console.info("plan()", actions);
    if (timeline.phase !== "planification") {
      return warnInconsistentState(
        `trying to plan action but phase is not "planification"`,
        { phase: timeline.phase, action: actions }
      );
    }

    timeline.planAction(actions);
  };

  const submitPlanification = () => {
    const { phase, activeCard, next, future } = timeline;
    if (phase !== "planification") {
      return warnInconsistentState(
        `trying to submit planification but phase is not "planification"`,
        { phase, activeCard, next, future }
      );
    }
    console.info("submitPlanification()");

    const pendingNextActions = next.filter((card) => !card.commited);
    if (pendingNextActions.length !== 1) {
      return warnInconsistentState(
        `trying to submit planification but there are ${pendingNextActions.length} pending actions`,
        { phase, activeCard, next, future }
      );
    }

    const pendingFutureActions = future.filter((card) => !card.commited);
    if (pendingFutureActions.length !== 1) {
      return warnInconsistentState(
        `trying to submit planification but there are ${pendingFutureActions.length} pending actions`,
        { phase, activeCard, next, future }
      );
    }

    timeline.submitPlanification();
    if (isPlanningComplete({ next, players })) {
      timeline.startActionPhase();
    }
  };

  const skip = () => {
    const { phase, activeCard } = timeline;
    if (
      activeCard?.cardType !== "actionCard" ||
      activeCard?.owner !== activePlayer
    ) {
      return warnInconsistentState(
        `trying to skip action but active card is not an action card`,
        { phase, activeCard }
      );
    }
    _resolveActionCard({ players });
  };

  return (
    <GameContext.Provider
      value={{
        phase: timeline.phase,
        winner: timeline.winner,
        activeCard: timeline.activeCard,
        activePlayer,
        next: timeline.next,
        future: timeline.future,
        board,
        players,
        build,
        move,
        recruit,
        skip,
        firstPlayer,
        plan,
        submitPlanification,
        newGame,
        loadSavegame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  return useContext(GameContext);
}
