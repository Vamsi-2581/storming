import type { Random } from "lib/random";

/**
 * Rotates the turn order so `first` is at index 0, keeping the clockwise order.
 *
 * ```
 * rotateToFirst({ players: [p, e1, e2, e3], first: "enemy2" })
 * // [e2, e3, p, e1]
 * ```
 */
export function rotateToFirst({
  players,
  first,
}: {
  players: PlayerStatus[];
  first: PlayerType;
}) {
  const index = players.findIndex(({ player }) => player === first);
  if (index === -1) {
    return players;
  }
  return [...players.slice(index), ...players.slice(0, index)];
}

/**
 * Picks a random starting player and rotates the table without changing its direction.
 * The injected random source makes the selection deterministic in tests.
 */
export function randomizeFirstPlayer({
  players,
  random,
}: {
  players: PlayerStatus[];
  random: Pick<Random, "int">;
}) {
  if (players.length < 2) {
    return players;
  }
  const index = Math.max(
    0,
    Math.min(random.int(players.length), players.length - 1)
  );
  return rotateToFirst({ players, first: players[index].player });
}
