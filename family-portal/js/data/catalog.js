/**
 * Shop catalogue for demo mode. Mirrors the seed at the bottom of
 * supabase/schema.sql — keep the two lists in sync when adding items.
 */
export const CATALOG = [
  { name: 'Superstar', description: 'A shining star next to your name everywhere in the portal.', cost: 30, type: 'badge', icon: '⭐', meta: {}, sort_order: 10 },
  { name: 'Helper Hero', description: 'For the one who always lends a hand.', cost: 40, type: 'badge', icon: '🦸', meta: {}, sort_order: 11 },
  { name: 'Master Chef', description: 'Kitchen legend. Pancakes on demand.', cost: 35, type: 'badge', icon: '👩‍🍳', meta: {}, sort_order: 12 },
  { name: 'Bookworm', description: 'Reads under the covers with a torch.', cost: 25, type: 'badge', icon: '📚', meta: {}, sort_order: 13 },
  { name: 'Champion', description: 'The trophy badge. Earned, not given.', cost: 80, type: 'badge', icon: '🏆', meta: {}, sort_order: 14 },
  { name: 'Title: Captain Chaos', description: 'Shows "Captain Chaos" under your name in chat.', cost: 40, type: 'title', icon: '🌀', meta: { title: 'Captain Chaos' }, sort_order: 20 },
  { name: 'Title: Snack Boss', description: 'Shows "Chief Snack Officer" under your name in chat.', cost: 50, type: 'title', icon: '🍪', meta: { title: 'Chief Snack Officer' }, sort_order: 21 },
  { name: 'Title: Homework Hero', description: 'Shows "Homework Hero" under your name in chat.', cost: 30, type: 'title', icon: '✏️', meta: { title: 'Homework Hero' }, sort_order: 22 },
  { name: 'Title: The Legend', description: 'Shows "The Legend" under your name in chat.', cost: 100, type: 'title', icon: '👑', meta: { title: 'The Legend' }, sort_order: 23 },
  { name: 'Pet Rock', description: 'Low maintenance. Excellent listener.', cost: 10, type: 'object', icon: '🪨', meta: {}, sort_order: 30 },
  { name: 'Lucky Sock', description: 'The other one is still missing.', cost: 15, type: 'object', icon: '🧦', meta: {}, sort_order: 31 },
  { name: 'Crystal Ball', description: "Predicts what's for dinner with 50% accuracy.", cost: 45, type: 'object', icon: '🔮', meta: {}, sort_order: 32 },
  { name: 'Golden TV Remote', description: 'Ceremonial. Grants no actual control over the TV.', cost: 60, type: 'object', icon: '📺', meta: {}, sort_order: 33 },
  { name: 'Pine Tree', description: 'A cosy pine for your 3D family island.', cost: 20, type: 'decoration', icon: '🌲', meta: { model: 'tree' }, sort_order: 40 },
  { name: 'Street Lamp', description: 'A warm glowing lamp for your 3D island.', cost: 25, type: 'decoration', icon: '💡', meta: { model: 'lamp' }, sort_order: 41 },
  { name: 'Snowman', description: 'Never melts. Slightly judgemental.', cost: 30, type: 'decoration', icon: '⛄', meta: { model: 'snowman' }, sort_order: 42 },
  { name: 'Campfire', description: 'A flickering campfire for island story time.', cost: 35, type: 'decoration', icon: '🔥', meta: { model: 'campfire' }, sort_order: 43 },
  { name: 'Windmill', description: 'A spinning windmill for your 3D island.', cost: 60, type: 'decoration', icon: '🌬️', meta: { model: 'windmill' }, sort_order: 44 },
  { name: 'Hot Air Balloon', description: 'Floats lazily above your island.', cost: 75, type: 'decoration', icon: '🎈', meta: { model: 'balloon' }, sort_order: 45 },
  { name: 'Trophy Statue', description: 'A giant golden trophy for the island plaza.', cost: 90, type: 'decoration', icon: '🏆', meta: { model: 'trophy' }, sort_order: 46 },
  { name: 'Rocket', description: 'A hovering rocket, fuelled by family pride.', cost: 120, type: 'decoration', icon: '🚀', meta: { model: 'rocket' }, sort_order: 47 },
];

export const ITEM_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'badge', label: 'Badges' },
  { key: 'title', label: 'Chat titles' },
  { key: 'object', label: 'Objects' },
  { key: 'decoration', label: '3D décor' },
];
