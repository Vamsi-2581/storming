import { randomizeFirstPlayer, rotateToFirst } from "./player-order";

const status = (player: PlayerType): PlayerStatus => ({
  player,
  points: 0,
  greatestEmpirePoint: false,
});

const players = (["player", "enemy1", "enemy2", "enemy3"] as const).map(status);

const order = (list: PlayerStatus[]) => list.map(({ player }) => player);

describe("rotateToFirst()", () => {
  (
    [
      { first: "player", expected: ["player", "enemy1", "enemy2", "enemy3"] },
      { first: "enemy1", expected: ["enemy1", "enemy2", "enemy3", "player"] },
      { first: "enemy2", expected: ["enemy2", "enemy3", "player", "enemy1"] },
      { first: "enemy3", expected: ["enemy3", "player", "enemy1", "enemy2"] },
    ] as const
  ).forEach(({ first, expected }) => {
    test(`puts ${first} first, keeping the clockwise order`, () => {
      expect(order(rotateToFirst({ players, first }))).toEqual(expected);
    });
  });

  test("keeps each player's status", () => {
    const withPoints = players.map((p) =>
      p.player === "enemy1" ? { ...p, points: 3 } : p
    );
    expect(rotateToFirst({ players: withPoints, first: "enemy3" })).toEqual([
      status("enemy3"),
      status("player"),
      { ...status("enemy1"), points: 3 },
      status("enemy2"),
    ]);
  });

  test("returns the same order when the player isn't in the game", () => {
    const threePlayers = players.slice(0, 3);
    expect(rotateToFirst({ players: threePlayers, first: "enemy3" })).toBe(
      threePlayers
    );
  });
});

describe("randomizeFirstPlayer()", () => {
  (
    [
      { index: 0, expected: ["player", "enemy1", "enemy2", "enemy3"] },
      { index: 1, expected: ["enemy1", "enemy2", "enemy3", "player"] },
      { index: 2, expected: ["enemy2", "enemy3", "player", "enemy1"] },
      { index: 3, expected: ["enemy3", "player", "enemy1", "enemy2"] },
    ] as const
  ).forEach(({ index, expected }) => {
    test(`selects seat ${index}`, () => {
      expect(
        order(randomizeFirstPlayer({ players, random: { int: () => index } }))
      ).toEqual(expected);
    });
  });

  test("keeps each player's status while rotating", () => {
    const withPoints = players.map((p) =>
      p.player === "enemy1" ? { ...p, points: 3 } : p
    );
    expect(
      randomizeFirstPlayer({ players: withPoints, random: { int: () => 2 } })
    ).toEqual([
      status("enemy2"),
      status("enemy3"),
      status("player"),
      { ...status("enemy1"), points: 3 },
    ]);
  });

  test("clamps an out-of-range random index to the last seat", () => {
    expect(
      order(randomizeFirstPlayer({ players, random: { int: () => 4 } }))
    ).toEqual(["enemy3", "player", "enemy1", "enemy2"]);
  });
});
