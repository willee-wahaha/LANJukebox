import { apiRequest } from './client';
import type { Song } from '../types';

export const searchSongs = (keyword: string) =>
  apiRequest<Song[]>(`/songs/search?q=${encodeURIComponent(keyword)}`);

export const searchFromYt = (keyword: string) =>
  apiRequest<{ success: boolean }>(`/songs/searchyoutube?q=${encodeURIComponent(keyword)}`);
