import { apiRequest, jsonBody } from './client';
import type { Album, Song, AlbumOrder } from '../types';

export const getAlbums = () => apiRequest<Album[]>('/albums', { method: 'GET' });

export const getAlbumSongs = (albumId: string) =>
  apiRequest<Song[]>(`/albums/${encodeURIComponent(albumId)}/songs`, { method: 'GET' });

export const refreshDatabase = () =>
  apiRequest<{ success: boolean }>('/albums/refresh', { method: 'POST' });

export const setAlbumOrder = (order: AlbumOrder) =>
  apiRequest<Album[]>('/albums/order', {
      method: 'POST',
      body: jsonBody({ key: order.key, way: order.way }),
  });