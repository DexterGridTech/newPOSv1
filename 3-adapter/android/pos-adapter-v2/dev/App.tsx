import React from 'react';
import {  StyleSheet, Text, View } from 'react-native';

function App(): React.JSX.Element {
  return (
      <View style={styles.content}>
        <Text style={styles.title}>POS Adapter V2</Text>
        <Text style={styles.subtitle}>React Native 0.84.1</Text>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});

export default App;
