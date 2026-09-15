/**
 * @format
 */

// MUST be the first import — react-native-gesture-handler requires this at the entry point so its
// native module + handlers are set up before anything renders.
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundNotificationHandler } from './src/app/notifications/deepLinkRouter';

AppRegistry.registerComponent(appName, () => App);

// There is still NO headless background task and no background sync: 014 removed those entirely,
// because every ISDS call is a sign-in and the Provozní řád only permits a locally-installed
// application to sign in on a manual user command. Nothing here reaches the network.
//
// What is registered is the handler for TAPPING a reminder while the app is backgrounded or quit
// (Notifee requires it at the entry point). It runs only in response to the user tapping a
// notification they asked for, and all it does is queue `{boxId, messageId}` for the shell to
// navigate to once it is up. It cannot start a sync, and there is no sync for it to start.
registerBackgroundNotificationHandler();
