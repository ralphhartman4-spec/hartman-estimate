// src/components/QuickToast.js
import React from 'react';
import { View, Text, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function QuickToast({ message, darkMode }) {
  if (!message) return null;

  const toastAnim = new Animated.Value(0.93);

  React.useEffect(() => {
    Animated.spring(toastAnim, {
      toValue: 1,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={{
      position: 'absolute',
      top: 80,
      left: 20,
      right: 20,
      zIndex: 99999,
      alignItems: 'center',
      pointerEvents: 'none',
    }}>
      <Animated.View style={{
        height: 70,
        width: '90%',
        backgroundColor: darkMode ? '#166534' : '#10b981',  // Default green (like OFF state)
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: darkMode ? 0.7 : 0.4,
        shadowRadius: 16,
        elevation: 30,
        borderWidth: 2,
        borderColor: '#86efac',
        transform: [{ scale: toastAnim }],
      }}>
        <Icon name="check-circle" size={34} color="white" />
        <View style={{ marginLeft: 16 }}>
          <Text style={{
            color: 'white',
            fontWeight: '900',
            fontSize: 19,
          }}>
            {message}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
