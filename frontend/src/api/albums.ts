import { apiRequest } from './client';
import type { Album, Song } from '../types';

export const getAlbums = () => apiRequest<Album[]>('/albums');

export const getAlbumSongs = (albumId: string) =>
  apiRequest<Song[]>(`/albums/${encodeURIComponent(albumId)}/songs`);
