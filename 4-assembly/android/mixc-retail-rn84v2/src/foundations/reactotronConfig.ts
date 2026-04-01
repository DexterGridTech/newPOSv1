import Reactotron from 'reactotron-react-native';
import {reactotronRedux} from 'reactotron-redux';
import packageJson from '../../package.json';

const reactotronHost = (packageJson as {reactotron?: {host?: string}}).reactotron?.host ?? 'localhost';

const reactotron = Reactotron
    .configure({ name: 'IMPos2 Desktop V1', host: reactotronHost })
    .useReactNative({ asyncStorage: false, networking: { ignoreUrls: /symbolicate/ }, editor: false, errors: {veto: () => false}, overlay: false })
    .use(reactotronRedux())
    .connect();

if (__DEV__) {
    // @ts-ignore
    console.tron = reactotron;
}

export default reactotron;
