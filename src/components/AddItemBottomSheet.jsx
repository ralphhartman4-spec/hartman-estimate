// src/components/AddItemBottomSheet.jsx
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';

// These are used in your screen, so we’ll receive them via props
// (JOB_TYPES, saveJobTypes, showMsg, setItemsByJob are all in your parent screen)
const AddItemBottomSheet = ({
  visible,
  currentJob,
  darkMode,
  onClose,
  setItemsByJob,        // ← passed from parent
  JOB_TYPES,            // ← passed from parent
  saveJobTypes,         // ← passed from parent
  showMsg,              // ← passed from parent
}) => {
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ['70%'], []);

  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  const handleAdd = () => {
    const name = newItemName.trim();
    const price = parseFloat(newItemPrice);

    if (!name || isNaN(price)) {
      Alert.alert('Invalid', 'Enter name and valid price');
      return;
    }

    // Your original logic – 100% unchanged
    const updatedJobTypes = { ...JOB_TYPES };
    if (!updatedJobTypes[currentJob]) updatedJobTypes[currentJob] = [];
    updatedJobTypes[currentJob].push({ name, price });
    saveJobTypes(updatedJobTypes);

    setItemsByJob(prev => {
      const jobItems = prev[currentJob] || [];
      return { ...prev, [currentJob]: [...jobItems, { name, price, qty: 1 }] };
    });

    setNewItemName('');
    setNewItemPrice('');
    onClose();
    showMsg('Default item added');
  };

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      )}
      handleIndicatorStyle={{ backgroundColor: darkMode ? '#666' : '#999' }}
      backgroundStyle={{ backgroundColor: darkMode ? '#1f2937' : '#fff' }}
    >
      <View style={styles.container}>
        <View style={styles.handle} />
        <Text style={[styles.title, darkMode && { color: '#fff' }]}>
          Create Default Item for "{currentJob}"
        </Text>

        <TextInput
          style={[styles.input, darkMode && styles.inputDark]}
          placeholder="Item name"
          placeholderTextColor={darkMode ? '#999' : '#666'}
          value={newItemName}
          onChangeText={setNewItemName}
        />
        <TextInput
          style={[styles.input, darkMode && styles.inputDark]}
          placeholder="Price"
          placeholderTextColor={darkMode ? '#999' : '#666'}
          value={newItemPrice}
          onChangeText={setNewItemPrice}
          keyboardType="numeric"
        />

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.add} onPress={handleAdd}>
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  handle: { width: 40, height: 5, backgroundColor: '#ccc', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '600', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, marginBottom: 16, fontSize: 16 },
  inputDark: { backgroundColor: '#374151', color: '#fff' },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  cancel: { flex: 1, backgroundColor: '#e5e7eb', paddingVertical: 16, borderRadius: 12, marginRight: 12 },
  add: { flex: 1, backgroundColor: '#4f46e5', paddingVertical: 16, borderRadius: 12, marginLeft: 12 },
  cancelText: { textAlign: 'center', fontWeight: '600', color: '#374151' },
  addText: { textAlign: 'center', fontWeight: '600', color: '#fff' },
});

export default AddItemBottomSheet;
