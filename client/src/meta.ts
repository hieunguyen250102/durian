import type { Fruit, GorillaId } from '../../shared/types';

export const FRUIT_META: Record<Fruit, { name: string; img: string; color: string; tint: string }> = {
  strawberry: { name: 'Dâu', img: '/assets/fruit_strawberry.webp', color: '#e8473c', tint: '#fde3dc' },
  banana: { name: 'Chuối', img: '/assets/fruit_banana.webp', color: '#e7b416', tint: '#fdf1c7' },
  grape: { name: 'Nho', img: '/assets/fruit_grape.webp', color: '#8a4fc8', tint: '#eee1fb' },
  durian: { name: 'Sầu riêng', img: '/assets/fruit_durian.webp', color: '#6c9a1f', tint: '#e6f3cf' },
};

export const GORILLA_META: Record<GorillaId, { name: string; img: string; inventory: string; color: string }> = {
  mitch: {
    name: 'Anh cả Mitch',
    img: '/assets/gorilla_mitch_cancel_three.webp',
    inventory: 'Hủy mọi đơn có 3 trái',
    color: '#4fae84',
  },
  murphy: {
    name: 'Em út Murphy',
    img: '/assets/gorilla_murphy_zero.webp',
    inventory: 'Không có tác dụng (0 trái)',
    color: '#9a7bd1',
  },
  hannah: {
    name: 'Chị Hannah',
    img: '/assets/gorilla_hanna_unlimited_banana.webp',
    inventory: 'Hủy mọi đơn chuối',
    color: '#ef6f67',
  },
};

export const AVATAR_COLORS = ['#2bb3a3', '#f26b5b', '#8d6ad8', '#f0b429', '#58b35a', '#3f8fe0', '#e46fb2'];
export const AVATAR_EMOJI = ['🍓', '🍌', '🍇', '🥭', '🍍', '🥝', '🍑'];

export const tokenImg = (n: number) => `/assets/anger_0${n}.webp`;
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
