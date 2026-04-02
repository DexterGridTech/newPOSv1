import Reactotron from 'reactotron-react-native';
import {reactotronRedux} from 'reactotron-redux';
import packageJson from '../../package.json';

type ReactotronConfig = {
  emulatorHost?: string;
  deviceHost?: string;
};

type PackageJsonWithReactotron = {
  reactotron?: ReactotronConfig;
};

type ReactotronInstance = ReturnType<typeof Reactotron.configure>;
type ReactotronSessionOptions = {
  isEmulator: boolean;
  displayIndex: number;
  deviceId: string;
};

const reactotronPackageConfig = (packageJson as PackageJsonWithReactotron).reactotron ?? {};

let reactotronInstance: ReactotronInstance | null = null;
let currentHost: string | null = null;
let currentClientName: string | null = null;

const buildReactotronClientName = ({displayIndex, deviceId}: Pick<ReactotronSessionOptions, 'displayIndex' | 'deviceId'>): string => {
  const screenLabel = displayIndex === 0 ? 'Main' : `Secondary-${displayIndex}`;
  return `IMPos2 Desktop V1 ${screenLabel} ${deviceId}`;
};

export const resolveReactotronHost = (isEmulator: boolean): string => {
  if (isEmulator) {
    return reactotronPackageConfig.emulatorHost ?? 'localhost';
  }
  return reactotronPackageConfig.deviceHost ?? '192.168.0.172';
};

export const getReactotron = ({isEmulator, displayIndex, deviceId}: ReactotronSessionOptions): ReactotronInstance => {
  const host = resolveReactotronHost(isEmulator);
  const clientName = buildReactotronClientName({displayIndex, deviceId});
  if (reactotronInstance && currentHost == host && currentClientName === clientName) {
    console.info(`[Reactotron] reuse host=${host} isEmulator=${isEmulator} name=${clientName}`);
    return reactotronInstance;
  }

  if (reactotronInstance) {
    reactotronInstance.close();
  }

  console.info(`[Reactotron] connect host=${host} isEmulator=${isEmulator} name=${clientName}`);

  reactotronInstance = Reactotron
    .configure({name: clientName, host})
    .useReactNative({
      asyncStorage: false,
      networking: {ignoreUrls: /symbolicate/},
      editor: false,
      errors: {veto: () => false},
      overlay: false,
    })
    .use(reactotronRedux())
    .connect();

  currentHost = host;
  currentClientName = clientName;

  if (__DEV__) {
    // @ts-ignore
    console.tron = reactotronInstance;
  }

  return reactotronInstance;
};
