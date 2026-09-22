/**
 * Preset avatars. Profiles store them as avatar_url = "preset:<key>";
 * anything else that is an http(s) URL is shown as an image.
 */
export const PRESET_AVATARS = [
  { key: 'fox', emoji: '🦊', bg: '#ffb86b' },
  { key: 'panda', emoji: '🐼', bg: '#cfd8dc' },
  { key: 'cat', emoji: '🐱', bg: '#ffd166' },
  { key: 'dog', emoji: '🐶', bg: '#e0b98f' },
  { key: 'owl', emoji: '🦉', bg: '#c3a58a' },
  { key: 'frog', emoji: '🐸', bg: '#a8e6a1' },
  { key: 'lion', emoji: '🦁', bg: '#ffcf70' },
  { key: 'tiger', emoji: '🐯', bg: '#ffae5c' },
  { key: 'unicorn', emoji: '🦄', bg: '#f5b8ff' },
  { key: 'dragon', emoji: '🐲', bg: '#8ee3a8' },
  { key: 'octopus', emoji: '🐙', bg: '#ff9eb5' },
  { key: 'penguin', emoji: '🐧', bg: '#9ed0ff' },
  { key: 'koala', emoji: '🐨', bg: '#b9c4cc' },
  { key: 'bunny', emoji: '🐰', bg: '#ffd6e8' },
  { key: 'bear', emoji: '🐻', bg: '#d4a373' },
  { key: 'monkey', emoji: '🐵', bg: '#e9c46a' },
  { key: 'robot', emoji: '🤖', bg: '#a0c4ff' },
  { key: 'alien', emoji: '👽', bg: '#b5f5a8' },
  { key: 'wizard', emoji: '🧙', bg: '#bdb2ff' },
  { key: 'dino', emoji: '🦖', bg: '#9be7b0' },
  { key: 'turtle', emoji: '🐢', bg: '#b7e4c7' },
  { key: 'butterfly', emoji: '🦋', bg: '#a5d8ff' },
  { key: 'bee', emoji: '🐝', bg: '#ffe066' },
  { key: 'sunflower', emoji: '🌻', bg: '#ffec99' },
];

const BY_KEY = new Map(PRESET_AVATARS.map((a) => [a.key, a]));

/** { kind: 'preset', emoji, bg } | { kind: 'image', url } | { kind: 'initials' } */
export function resolveAvatar(avatarUrl) {
  if (typeof avatarUrl === 'string') {
    if (avatarUrl.startsWith('preset:')) {
      const preset = BY_KEY.get(avatarUrl.slice(7));
      if (preset) return { kind: 'preset', ...preset };
    } else if (/^https?:\/\//i.test(avatarUrl)) {
      return { kind: 'image', url: avatarUrl };
    }
  }
  return { kind: 'initials' };
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2);
  return letters.toUpperCase();
}
