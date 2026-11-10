import { apiRequest, jsonBody } from './client';
import type { AudioDevice, PlayerMode, PlayerStatus } from '../types';

export const getPlayerStatus = () =>
  apiRequest<PlayerStatus>('/player/status');

export const playSong = (songId: string) =>
  apiRequest<{ success?: boolean; status: string }>('/player/play', {
    method: 'POST',
    body: jsonBody({ song_id: songId }),
  });

export const pausePlayer = () =>
  apiRequest<{ success?: boolean; status: string }>('/player/pause', { method: 'POST' });

export const resumePlayer = () =>
  apiRequest<{ success?: boolean; status: string }>('/player/resume', { method: 'POST' });

export const stopPlayer = () =>
  apiRequest<{ success?: boolean; status: string }>('/player/stop', { method: 'POST' });

export const nextSong = () =>
  apiRequest<{ success?: boolean; status: string }>('/player/next', { method: 'POST' });

export const previousSong = () =>
  apiRequest<{ success?: boolean; status: string }>('/player/previous', { method: 'POST' });

export const setPlayerVolume = (volume: number) =>
  apiRequest<{ success: boolean; volume: number }>('/player/volume', {
    method: 'PUT',
    body: jsonBody({ volume }),
  });

export const seekPlayer = (position: number) =>
  apiRequest<{ success: boolean; position: number; duration: number }>('/player/seek', {
    method: 'PUT',
    body: jsonBody({ position }),
  });

export const setPlayerMode = (mode: PlayerMode) =>
  apiRequest<{ success: boolean; shuffle: boolean; repeat: PlayerMode['repeat'] }>('/player/mode', {
    method: 'PUT',
    body: jsonBody(mode),
  });

export const getAudioDevices = () =>
  apiRequest<{ devices: AudioDevice[]; selected_device_id: string }>('/player/devices');

export const setAudioDevice = (deviceId: string) =>
  apiRequest<{ success: boolean; selected_device_id: string; selected_device_name: string }>
  (`/player/device/${deviceId}`, { method: 'PUT' });
