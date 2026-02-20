import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {View} from "react-native";

export default function DevApp() {
  return (
    <SafeAreaProvider>
        <View />
    </SafeAreaProvider>
  );
}
