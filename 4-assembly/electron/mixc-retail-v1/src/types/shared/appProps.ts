import type {ScreenMode} from '@impos2/kernel-core-base';

export interface AppProps {
  deviceId: string;
  screenMode: ScreenMode;
  displayCount: number;
  displayIndex: number;
  windowRole: 'primary' | 'secondary';
  isPackaged: boolean;
  runtimeSource: 'dev-server' | 'bundled';
}
