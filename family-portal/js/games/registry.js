/**
 * Game catalogue. Metadata is available immediately; each game's rules/UI
 * module is loaded on demand with load().
 */
export const GAMES = {
  battleships: {
    type: 'battleships',
    name: 'Battleships',
    icon: '🚢',
    tagline: 'Hide your fleet, hunt theirs. Turn-based naval showdown.',
    reward: 20,
    load: () => import('./battleships.js'),
  },
  pool: {
    type: 'pool',
    name: 'Pool',
    icon: '🎱',
    tagline: '8-ball with real physics. Aim, set power, sink your group.',
    reward: 15,
    load: () => import('./pool.js'),
  },
  poker: {
    type: 'poker',
    name: 'Poker',
    icon: '🃏',
    tagline: "Heads-up Texas Hold'em. Six hands, chip leader wins.",
    reward: 15,
    load: () => import('./poker.js'),
  },
};

export const GAME_LIST = Object.values(GAMES);

export function opponentOf(match, userId) {
  return match.player1_id === userId ? match.player2_id : match.player1_id;
}

/** True when the match is waiting for this user to do something. */
export function needsAction(match, userId) {
  if (match.status === 'pending') return match.player2_id === userId;
  if (match.status !== 'active') return false;
  if (match.current_turn) return match.current_turn === userId;
  if (match.game_type === 'battleships') {
    const state = match.game_state || {};
    return state.phase === 'placement' && !state.fleets?.[userId];
  }
  return false;
}

export function matchStatusLabel(match, userId) {
  if (match.status === 'pending') return match.player2_id === userId ? 'Challenge received' : 'Waiting for reply';
  if (match.status === 'declined') return 'Declined';
  if (match.status === 'cancelled') return 'Cancelled';
  if (match.status === 'finished') {
    if (!match.winner_id) return 'Draw';
    return match.winner_id === userId ? 'You won' : 'You lost';
  }
  if (needsAction(match, userId)) {
    if (match.game_type === 'battleships' && match.game_state?.phase === 'placement') return 'Place your ships';
    return 'Your turn';
  }
  if (match.game_type === 'battleships' && match.game_state?.phase === 'placement') return 'Opponent placing ships';
  return 'Their turn';
}
