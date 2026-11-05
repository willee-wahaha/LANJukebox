import { apiRequest, jsonBody } from './client';
import type { PlaylistResponse } from '../types';

export const getPlaylist = () => apiRequest<PlaylistResponse>('/playlist');

export const addToPlaylist = (songId: string) =>
  apiRequest<{ success: boolean }>('/playlist', {
    method: 'POST',
    body: jsonBody({ song_id: songId }),
  });

export const playPlaylist = () =>
  apiRequest<{ success: boolean }>('/playlist/play', { method: 'POST' });

export const playPlaylistFrom = (index: number) =>
  apiRequest<void>(`/playlist/playfrom/${index}`, { method: 'POST' });

export const removeFromPlaylist = (index: number) =>
  apiRequest<void>(`/playlist/${index}`, { method: 'DELETE' });

export const clearPlaylist = () =>
  apiRequest<void>('/playlist', { method: 'DELETE' });

export const reorderPlaylist = (order: string[]) =>
  apiRequest<{ success: boolean }>('/playlist/reorder', {
    method: 'PUT',
    body: jsonBody({ order }),
  });
