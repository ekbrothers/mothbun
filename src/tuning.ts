// Gameplay numbers in one place. Units are art pixels and seconds.
export const TUNING = {
  // movement
  gravity: 2300,
  jumpVelocity: 860, // about 160 px high, a bit under two rabbit heights
  jumpCut: 1.2, // extra gravity while rising after the button is let go (short hops)
  glideFall: 72, // max fall speed while holding
  jumpBufferMs: 130,
  coyote: 0.09,

  // run
  startSpeed: 230,
  maxSpeed: 400,
  levelLength: 18000, // about a minute at the speeds above
  brakeDistance: 700, // slow to a stop over this distance at the end
  lives: 3,

  // red-eye glare
  glareDuration: 0.3,
  glareCooldown: 1.1,
  glareRange: 300,
  glareHeight: 28, // beam is this tall, centered on the eye

  // scoring
  orbPoints: 25,
  stunPoints: 100,
  lifeBonus: 500,
};
