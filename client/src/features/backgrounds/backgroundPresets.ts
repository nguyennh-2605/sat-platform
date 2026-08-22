export const BACKGROUND_PRESETS = [
  { id: 'misty-hills', name: 'Amber Canopy', image: '/backgrounds/misty-hills.webp', source: 'https://pixabay.com/illustrations/anime-forest-nature-trees-woods-7687171/' },
  { id: 'mountain-forest', name: 'Emerald Grove', image: '/backgrounds/mountain-forest.webp', source: 'https://pixabay.com/illustrations/ai-generated-trees-anime-forest-8177320/' },
  { id: 'quiet-pines', name: 'Hidden River', image: '/backgrounds/quiet-pines.webp', source: 'https://pixabay.com/illustrations/ai-generated-anime-forest-jungle-8147933/' },
  { id: 'woodland-mist', name: 'Enchanted Pines', image: '/backgrounds/woodland-mist.webp', source: 'https://pixabay.com/illustrations/anime-forrest-nature-fantasy-7455351/' },
  { id: 'evergreen-mist', name: 'Sunlit Clearing', image: '/backgrounds/evergreen-mist.webp', source: 'https://pixabay.com/illustrations/anime-animation-forrest-nature-7685255/' },
  { id: 'forest-clouds', name: 'Mountain Village', image: '/backgrounds/forest-clouds.webp', source: 'https://pixabay.com/illustrations/ai-generated-mountain-village-anime-9465580/' },
] as const;

export type BackgroundId = 'default' | typeof BACKGROUND_PRESETS[number]['id'];

export const backgroundById = (id: BackgroundId) => BACKGROUND_PRESETS.find(item => item.id === id);
export const normalizeBackgroundId = (id: string | null | undefined): BackgroundId => id === 'default' || BACKGROUND_PRESETS.some(item => item.id === id) ? id as BackgroundId : 'default';
