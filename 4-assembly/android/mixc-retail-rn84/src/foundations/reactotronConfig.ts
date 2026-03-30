import Reactotron from 'reactotron-react-native';
import {reactotronRedux} from 'reactotron-redux';
import packageJson from '../../package.json';

const reactotron = Reactotron
    .configure({ name: 'IMPos2 Desktop V1', host: packageJson.reactotron.host })
    .useReactNative({ asyncStorage: false, networking: { ignoreUrls: /symbolicate/ }, editor: false, errors: {veto: () => false}, overlay: false })
    .use(reactotronRedux())
    .connect();

if (__DEV__) {
    // @ts-ignore
    console.tron = reactotron;
}

export default reactotron;
