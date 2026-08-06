import {registerRootComponent} from 'expo'

import App from './App'

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
// and works the same whether the app runs in Expo Go or a native build —
// the standard Expo SDK 57 entry point (see the `expo-template-blank-typescript`
// template this file mirrors).
registerRootComponent(App)
