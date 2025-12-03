import { invoke } from '@tauri-apps/api/core';

let isInitialized = false;

export const initDiscordRPC = async (): Promise<void> => {
  if (isInitialized) {
    console.log('Discord RPC уже инициализирован');
    return;
  }

  try {
    const result = await invoke<string>('init_discord_rpc');
    console.log('✅', result);
    isInitialized = true;
  } catch (error) {
    console.warn('⚠️ Discord не запущен или недоступен:', error);
    // Не выбрасываем ошибку, чтобы приложение продолжило работу
  }
};

export const updatePresence = async (options: {
  details?: string;
  state?: string;
  largeImage?: string;
  largeText?: string;
}): Promise<void> => {
  if (!isInitialized) {
    await initDiscordRPC();
  }

  try {
    await invoke('update_discord_presence', {
      details: options.details,
      state: options.state,
      largeImage: options.largeImage,
      largeText: options.largeText,
    });
  } catch (error) {
    console.warn('Не удалось обновить Discord presence:', error);
  }
};

export const clearPresence = async (): Promise<void> => {
  if (!isInitialized) return;

  try {
    await invoke('clear_discord_presence');
  } catch (error) {
    console.warn('Не удалось очистить Discord presence:', error);
  }
};

export const disconnectDiscordRPC = async (): Promise<void> => {
  if (!isInitialized) return;

  try {
    await invoke('disconnect_discord_rpc');
    isInitialized = false;
  } catch (error) {
    console.warn('Не удалось отключить Discord RPC:', error);
  }
};

export const isDiscordConnected = (): boolean => isInitialized;
