






// App.js — FINAL VERSION: Job Types store default items + load from Database + long-press edit
import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView, View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Modal,
  KeyboardAvoidingView, Platform, Alert, FlatList, ActivityIndicator,
} from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Host, Portal } from 'react-native-portalize';

import {
  TouchableOpacity as GestureTouchableOpacity,
  // Optional: also get other touchables if needed
} from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { formatPrice } from './utils/formatters';
import * as ImageManipulator from 'expo-image-manipulator';
//import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { Linking } from 'react-native';
import * as Contacts from 'expo-contacts';
import { Picker } from '@react-native-picker/picker';
import { Animated, Easing } from 'react-native';
import Toast from 'react-native-toast-message';
import { Dimensions } from 'react-native';
const window = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HartmanLogo from './src/components/HartmanLogo';
import QuickToast from './src/components/QuickToast';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';


export default function App() {
  const APP_NAME = "Hartman Estimate";  // ← CHANGE TO YOUR APP NAME
  const APP_LOGO = require('./assets/hartman-logo.png');  // ← ADD YOUR LOGO TO assets/
  const [companyName, setCompanyName] = useState('');
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [itemsByJob, setItemsByJob] = useState({});
  const [selectedItems, setSelectedItems] = useState({});

  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    // Platform-specific API keys
    const iosApiKey = 'test_aWjSEqsVfKpYuCxHfMxqwAFxQqu';
    const androidApiKey = 'goog_YcKkyVqAfcsgnLFqvbEyeVduCkm';

    if (Platform.OS === 'ios') {
       Purchases.configure({apiKey: iosApiKey});
    } else if (Platform.OS === 'android') {
       Purchases.configure({apiKey: androidApiKey});
    }
  }, []);
  
  // Inside your main App component or a dedicated RevenueCat provider
useEffect(() => {
  // Optional: Initial fetch to set state immediately on app launch
  const checkInitialStatus = async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      if (customerInfo.entitlements.active['pro']) {
        setIsPro(true);
      }
    } catch (e) {
      console.error('Initial CustomerInfo fetch failed', e);
    }
  };
  checkInitialStatus();

  // Add the listener
  const listener = Purchases.addCustomerInfoUpdateListener((customerInfo) => {
    console.log('CustomerInfo updated:', customerInfo.entitlements.active);

    if (customerInfo.entitlements.active['pro']) {
      setIsPro(true);
      setShowPaywall(false);
      showQuickToast('Pro unlocked! 🎉');
    } else {
      setIsPro(false); // Handle downgrade/expiration if needed
    }
  });

  // Cleanup on unmount (critical to avoid leaks)
  return () => {
    listener.remove(); // Newer SDKs return a removable listener
    // OR: Purchases.removeCustomerInfoUpdateListener(listener); // Older style
  };
}, []);


//permission for notifications 
useEffect(() => {
  const setupNotifications = async () => {
    // Only on physical devices
    if (!Device.isDevice) {
      console.log('Notifications require a physical device');
      return;
    }

    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Request permission
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permission denied');
      return;
    }

    // Get Expo push token
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    console.log('Expo Push Token:', token);

    // Save locally
    await AsyncStorage.setItem('expoPushToken', token);

    // === SEND TOKEN TO BACKEND ===
    try {
      await fetch('https://hartman-estimate.vercel.app/api/save-push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      console.log('Push token sent to backend');
    } catch (err) {
      console.error('Failed to send push token to backend:', err);
    }
  };

  setupNotifications();
}, []);

const purchasePro = async () => {
  if (!proPackage) {
    showQuickToast('Subscription not loaded — retry in a moment');
    return;
  }

  try {
    showQuickToast('Opening purchase...');

    const { customerInfo } = await Purchases.purchasePackage(proPackage);

    if (customerInfo.entitlements.active['pro']) {
      setIsPro(true);
      setShowPaywall(false);
      showQuickToast('Welcome to Pro! 🎉');
    }
  } catch (error) {
    if (!error.userCancelled) {
      showQuickToast('Purchase failed: ' + error.message);
    }
  }
};



//Paywall



useEffect(() => {
  const handleDeepLink = async ({ url }) => {
    if (!url) return;

    const match = url.match(/connectedAccountId=([a-zA-Z0-9_]+)/);
    if (match && match[1]) {
      const accountId = match[1];
      await AsyncStorage.setItem('connectedStripeAccountId', accountId);
      setIsStripeConnected(true);

      // === CELEBRATION ANIMATION ON RETURN FROM STRIPE ===
      connectAnim.setValue(0);
      Animated.sequence([
        Animated.spring(connectAnim, {
          toValue: 1.25,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(connectAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
      // ================================================
    }
  };

  const subscription = Linking.addEventListener('url', handleDeepLink);

  // On app start: check if already connected
  AsyncStorage.getItem('connectedStripeAccountId').then(id => {
    if (id) {
      setIsStripeConnected(true);
      // Optional: small pulse if reopening app while connected
      connectAnim.setValue(1);
    }
  });

  Linking.getInitialURL().then(url => {
    if (url) handleDeepLink({ url });
  });

  return () => subscription.remove();
}, []);
  
  useEffect(() => {
  const initRevenueCat = async () => {
    setOfferingsLoading(true);
    try {
      console.log('Fetching customer info & offerings...');

      // Check if already Pro
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('CustomerInfo:', customerInfo);
      if (customerInfo.entitlements.active['pro']) {
        setIsPro(true);
        setOfferingsLoading(false);
        return;
      }

      // Fetch offerings
      const offerings = await Purchases.getOfferings();
      console.log('Offerings:', offerings);

      if (offerings.current && offerings.current.availablePackages.length > 0) {
        // Pick monthly or first available
        const pkg = offerings.current.monthly || offerings.current.availablePackages[0];
        setProPackage(pkg);
        console.log('Package ready:', pkg.product.priceString);
      } else {
        console.warn('No packages in current offering');
        showQuickToast('No subscription available yet');
      }
    } catch (error) {
      console.error('RevenueCat error:', error);
      showQuickToast('Subscription load failed: ' + error.message);
    } finally {
      setOfferingsLoading(false);
    }
  };

  initRevenueCat();
}, []);


const [showPaywall, setShowPaywall] = useState(false);
  
  const [showItemDatabasePicker, setShowItemDatabasePicker] = useState(false);
const [selectedDatabaseItems, setSelectedDatabaseItems] = useState({}); // { 'item-0': true }

const [selectedHistoryIds, setSelectedHistoryIds] = useState({}); // { 'doc-123': true }
const [isHistoryMultiSelect, setIsHistoryMultiSelect] = useState(false);
  
  
  const [isInvoiceMode, setIsInvoiceMode] = useState(false);
const [invoiceNumber, setInvoiceNumber] = useState('1001');
const [dueDate, setDueDate] = useState('');

const [showDisconnectMenu, setShowDisconnectMenu] = useState(false);


const [selectedCurrency, setSelectedCurrency] = useState(null);
const [selectedLaborType, setSelectedLaborType] = useState('standard');
const [laborRates, setLaborRates] = useState({}); 


const [showDeleteDocConfirm, setShowDeleteDocConfirm] = useState(false);
const [docToDelete, setDocToDelete] = useState(null);

const [customerModalMessage, setCustomerModalMessage] = useState('');

{/* STATE — ADD THESE WITH YOUR OTHER useState (near the top) */}
const [isTemplateMultiSelect, setIsTemplateMultiSelect] = useState(false);
const [selectedTemplates, setSelectedTemplates] = useState({});
  

  const [standardHours, setStandardHours] = useState('');
  const [otHours, setOtHours] = useState('');
  const [travelHours, setTravelHours] = useState('');
  const [standardRate, setStandardRate] = useState('');
  const [otRate, setOtRate] = useState('');
  const [travelRate, setTravelRate] = useState('');
  const [markupPercent, setMarkupPercent] = useState('');
  const [logoUri, setLogoUri] = useState(null);
  const [TEMPLATES, setTEMPLATES] = useState({});
  const [JOB_TYPES, setJOB_TYPES] = useState({}); // ← { "Plumbing": [{name:"Pipe", price:12.5}], ... }
  const [DEFAULT_ITEMS_BY_JOB, setDEFAULT_ITEMS_BY_JOB] = useState({}); // → { "Plumbing": [{name: "Pipe", price: 12.5}], ... }
  const [GLOBAL_ITEMS, setGLOBAL_ITEMS] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [jobsitePhotos, setJobsitePhotos] = useState([]);
  const [selectedForDelete, setSelectedForDelete] = useState({}); // { 'job-Plumbing': true, 'item-0': true }
  
  const [contractorEmail, setContractorEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  
  const [helpMode, setHelpMode] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  
  const [showHistory, setShowHistory] = useState(false);
const [allDocuments, setAllDocuments] = useState([]); // Master list
const [historyFilter, setHistoryFilter] = useState('all'); // all, outstanding, paid, overdue

//PAYMENTS

const [paymentUrl, setPaymentUrl] = useState(''); // ← ADD THIS LINE
const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);

  // MODALS
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [currentJob, setCurrentJob] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [showEditJob, setShowEditJob] = useState(false);
  const [editJobOld, setEditJobOld] = useState('');
  const [editJobNew, setEditJobNew] = useState('');
  const [showEditItem, setShowEditItem] = useState(false);
  const [editItemJob, setEditItemJob] = useState('');
  const [editItemIdx, setEditItemIdx] = useState(-1);
  const [editItemName, setEditItemName] = useState('');
  const [editItemQty, setEditItemQty] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [showLabor, setShowLabor] = useState(false);
  const [tempSH, setTempSH] = useState('');
  const [tempOH, setTempOH] = useState('');
  const [tempTH, setTempTH] = useState('');
  const [tempSR, setTempSR] = useState('');
  const [tempOR, setTempOR] = useState('');
  const [tempTR, setTempTR] = useState('');
  const [showMarkup, setShowMarkup] = useState(false);
  const [tempMarkup, setTempMarkup] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUri, setPdfUri] = useState(null);
  
  const [companyPhone, setCompanyPhone] = useState('');
  
  const [addItemMode, setAddItemMode] = useState('normal'); // 'normal' or 'globalOnly'
  
  const [customerDatabase, setCustomerDatabase] = useState([]); // ← NEW: saved customers
const [showCustomerMenu, setShowCustomerMenu] = useState(false); // dropdown menu
const [showAddCustomerForm, setShowAddCustomerForm] = useState(false); // add new form
const [customerSearch, setCustomerSearch] = useState(''); // search in database list
  
 
  const [showDeleteJobsConfirm, setShowDeleteJobsConfirm] = useState(false);
  const [showItemDeleteConfirm, setShowItemDeleteConfirm] = useState(false);
  const [itemDeleteJob, setItemDeleteJob] = useState('');
  const [itemDeleteCount, setItemDeleteCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showNameRequired, setShowNameRequired] = useState(false);
  
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  
  const [helpPositions, setHelpPositions] = useState({});

const setPosition = (key, layout) => {
  setHelpPositions(prev => ({ ...prev, [key]: layout }));
};
  
  const [notes, setNotes] = useState('');  
  
  const printPDF = async (uriToPrint) => {
  if (!uriToPrint) return showMsg('No PDF to print');

  try {
    await Print.printAsync({
      uri: uriToPrint,
    });
  } catch (err) {
    showMsg('Print failed');
  }
};

const StepBadge = ({ number }) => (
  <View style={{
    position: 'absolute',
    top: -12,
    left: -12,
    backgroundColor: '#10b981',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: darkMode ? '#111827' : '#ffffff',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  }}>
    <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>{number}</Text>
  </View>
);


// === REUSABLE: Generate Invoice/Estimate PDF with optional payment link ===
const generateDocumentPdf = async ({
  isInvoice = false,
  invoiceNumber,
  customer,
  companyName,
  companyAddress,
  companyPhone,
  contractorEmail,
  logoUri,
  jobs,
  itemsByJob,
  notes = '',
  jobsitePhotos = [],
  labor = {},          // { standardHours, otHours, travelHours }
  rates = {},          // { standardRate, otRate, travelRate }
  markupPercent = 0,
  taxPercent = 0,
  overridePaymentUrl = null,  // Fresh link from caller (most reliable)
  grandTotalOverride = null,  // Optional pre-calculated total
}) => {

  let paymentLink = overridePaymentUrl;

  // === Calculate totals ===
  const allItems = jobs.flatMap(j => itemsByJob[j] || []);
  const subtotal = allItems.reduce((sum, i) => sum + (i.qty || 1) * i.price, 0);
  const markupAmount = subtotal * (parseFloat(markupPercent) / 100);
  const markupTotal = subtotal + markupAmount;
  const taxTotal = markupTotal * (parseFloat(taxPercent) / 100);
  const laborTotal =
    (parseFloat(labor.standardHours || 0) * parseFloat(rates.standardRate || 0)) +
    (parseFloat(labor.otHours || 0) * parseFloat(rates.otRate || 0)) +
    (parseFloat(labor.travelHours || 0) * parseFloat(rates.travelRate || 0));
  const grandTotal = grandTotalOverride || (markupTotal + taxTotal + laborTotal);

  // === Generate payment link if invoice and no override provided ===
 // === Generate payment link ONLY if invoice, connected to Stripe, and no override ===
if (isInvoice && grandTotal > 0 && isStripeConnected && !overridePaymentUrl) {
  try {
    const amountInCents = Math.round(grandTotal * 100);
    const response = await fetch('https://hartman-estimate.vercel.app/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountInCents,
        invoiceId: invoiceNumber,
        customerName: customer.name || 'Customer',
        customerEmail: customer.email || null,
      }),
    });
    const data = await response.json();
    if (data.url) {
      paymentLink = data.url;
    }
  } catch (err) {
    console.warn('Auto payment link failed', err);
    showMsg('Payment link unavailable - not connected to Stripe');
  }
}



  // === Logo ===
  let logoHtml = '';
  if (logoUri) {
    try {
      const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: FileSystem.EncodingType.Base64 });
      const ext = logoUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      logoHtml = `<img src="data:image/${ext};base64,${base64}" style="width:140px;height:auto;margin-bottom:20px;" />`;
    } catch (e) {}
  }

  // === Photos ===
  const photoTags = await Promise.all(
    jobsitePhotos.map(async (uri) => {
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        return `<img src="data:image/jpeg;base64,${base64}" style="width:300px;height:300px;object-fit:cover;border-radius:16px;margin:10px;" />`;
      } catch { return ''; }
    })
  );

  // === Payment Button ===
  const paymentButtonHTML = paymentLink ? `
<div style="margin-top:60px; padding:32px; background:#f8f4ff; border-radius:20px; text-align:center; border:3px solid #635bff;">
  <p style="font-size:24px; font-weight:900; color:#635bff; margin-bottom:16px;">
    Pay This Invoice
  </p>
  <a href="${paymentLink}" style="display:inline-block; background:#635bff; color:white; padding:20px 48px; border-radius:20px; font-size:20px; font-weight:bold; text-decoration:none;">
    Pay Now • Card • Apple Pay • Google Pay
  </a>
  <p style="margin-top:16px; color:#64748b; font-size:14px;">
    Secure payment powered by Stripe
  </p>
</div>
` : '';
// Watermark — only for free users
const watermarkHTML = !isPro ? `
  <div style="
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 80px;
    font-weight: 900;
    color: rgba(0,0,0,0.08);
    pointer-events: none;
    user-select: none;
    z-index: 999;
    white-space: nowrap;
    letter-spacing: 8px;
  ">
    DRAFT
  </div>
` : '';
  // === HTML Template ===
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Helvetica, Arial, sans-serif; padding: 40px; background:white; color:#1f2937; }
    .title { font-size:36px; font-weight:bold; color:#10b981; text-align:center; margin:30px 0; }
    table { width:100%; border-collapse:collapse; margin:30px 0; }
    th, td { padding:12px; text-align:left; border-bottom:1px solid #e2e8f0; }
    th { background:#f0fdf4; }
    .right { text-align:right; }
    .total { font-weight:bold; font-size:18px; background:#ecfdf5; }
    .grand { font-size:24px; color:#10b981; font-weight:900; }
  </style>
</head>
<body>
  ${logoHtml}

  ${companyName ? `<div style="font-size: 20px; font-weight: bold;">${companyName}</div>` : ''}
  ${companyAddress ? `<div style="font-size: 16px; margin-top: 8px;">${companyAddress}</div>` : ''}
  ${companyPhone ? `<div style="font-size: 16px;">${companyPhone}</div>` : ''}
  ${contractorEmail ? `<div style="font-size: 16px;">${contractorEmail}</div>` : ''}

  <div class="title">${isInvoice ? 'INVOICE' : 'ESTIMATE'}</div>
  <div style="text-align:center; font-size:20px; margin:20px 0;">
    ${isInvoice ? `Invoice #${invoiceNumber}` : `Estimate #E-${invoiceNumber}`}<br>
    Date: ${new Date().toLocaleDateString()}
  </div>

  <p><strong>Customer:</strong> ${customer.name || ''}</p>
  ${customer.phone ? `<p><strong>Phone:</strong> ${customer.phone}</p>` : ''}
  ${customer.email ? `<p><strong>Email:</strong> ${customer.email}</p>` : ''}
  ${customer.address ? `<p><strong>Address:</strong> ${customer.address}</p>` : ''}

${allItems.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qty</th>
        <th class="right">Price</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${allItems.map(i => {
        const itemTotal = (i.qty || 1) * i.price;
        return `
          <tr>
            <td>${i.name}</td>
            <td style="text-align:center">${i.qty || 1}</td>
            <td class="right">${getCurrencySymbol()}${formatPrice(i.price)}</td>
            <td class="right">${getCurrencySymbol()}${formatPrice(itemTotal)}</td>
          </tr>
        `;
      }).join('')}
      
      <!-- SUBTOTAL — NOW INCLUDES MARKUP SILENTLY -->
      <tr class="total">
        <td colspan="3">Subtotal</td>
        <td class="right">${getCurrencySymbol()}${formatPrice(subtotal + markupAmount)}</td>
      </tr>

      <!-- TAX ROW — ONLY IF > 0 -->
      ${taxTotal > 0 ? `
        <tr class="total">
          <td colspan="3">Tax (${taxPercent}%)</td>
          <td class="right">${getCurrencySymbol()}${formatPrice(taxTotal)}</td>
        </tr>
      ` : ''}

      <!-- LABOR ROW — ONLY IF > 0 -->
      ${laborTotal > 0 ? `
        <tr class="total">
          <td colspan="3">Labor</td>
          <td class="right">${getCurrencySymbol()}${formatPrice(laborTotal)}</td>
        </tr>
      ` : ''}

      <!-- GRAND TOTAL -->
      <tr class="total grand">
        <td colspan="3"><strong>TOTAL</strong></td>
        <td class="right"><strong>${getCurrencySymbol()}${formatPrice(grandTotal)}</strong></td>
      </tr>
    </tbody>
  </table>

  <!-- SUBTLE FINE-PRINT NOTE — ONLY MENTION OF OVERHEAD -->
  <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; font-style: italic;">
    Prices include overhead and profit margin
  </div>
` : ''}

  ${notes ? `<p><strong>Notes:</strong><br>${notes.replace(/\n/g, '<br>')}</p>` : ''}

  ${photoTags.length > 0 ? `<div style="margin-top:40px;"><strong>Jobsite Photos</strong><div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;margin-top:20px;">${photoTags.join('')}</div></div>` : ''}

  ${paymentButtonHTML}
  ${watermarkHTML}

  ${isInvoice ? `<p style="margin-top:50px; color:#8b5cf6; font-weight:bold; font-style:italic;">
    Converted from Estimate #E-${invoiceNumber} on ${new Date().toLocaleDateString()}
  </p>` : ''}

</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html });

  return {
    pdfUri: uri,
    paymentUrl: paymentLink,
    grandTotal,
  };
};

//PAYMENTS

const convertedAnim = useRef(new Animated.Value(1)).current;

const connectAnim = useRef(new Animated.Value(1)).current;

const generateSpin = useRef(new Animated.Value(0)).current;

useEffect(() => {
  const handleUrl = async (url) => {
    if (url.includes('stripe-connected')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const accountId = params.get('accountId');
      if (accountId) {
        await AsyncStorage.setItem('connectedStripeAccountId', accountId);
        setIsStripeConnected(true);
        showQuickToast('Connected to Stripe!');
        // Trigger celebration animation
      }
    }
  };

  Linking.addEventListener('url', ({ url }) => handleUrl(url));
  Linking.getInitialURL().then(url => url && handleUrl(url));
}, []);



useEffect(() => {
  if (isGeneratingPayment) {
    generateSpin.setValue(0);
    Animated.loop(
      Animated.timing(generateSpin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }
}, [isGeneratingPayment]);


const generatePaymentLink = async (doc) => {
  // Safety checks
  if (doc.type !== 'invoice' || doc.status === 'paid' || doc.paymentUrl) {
    return;
  }

  setIsGeneratingPayment(true);

  try {
    const totalDollars = doc.amount || doc.grandTotal || 0;
    const amountInCents = Math.round(totalDollars * 100);

    if (totalDollars >= 1000000) {
      showMsg('Invoice too large for online payment');
      return;
    }

    const response = await fetch('https://hartman-estimate.vercel.app/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountInCents,
        invoiceId: doc.invoiceNumber,
        customerName: doc.customer?.name || 'Customer',
        customerEmail: doc.customer?.email || null,
      }),
    });

    const data = await response.json();

    if (data.url) {
      // === REGENERATE PDF WITH THE PAYMENT LINK (THIS FIXES THE EDGE CASE) ===
      const pdfResult = await generateDocumentPdf({
        isInvoice: true,
        invoiceNumber: doc.invoiceNumber,
        customer: doc.customer || {},
        companyName,
        companyAddress,
        companyPhone,
        contractorEmail,
        logoUri,
        jobs: doc.jobs || [],
        itemsByJob: doc.itemsByJob || {},
        notes: doc.notes || '',
        jobsitePhotos: doc.jobsitePhotos || [],
        labor: doc.labor || {},
        rates: doc.rates || {},
        markupPercent: doc.markupPercent || 0,
        taxPercent: doc.taxPercent || 0,
        grandTotalOverride: doc.grandTotal || doc.amount,
        overridePaymentUrl: data.url,  // ← THIS ADDS THE "PAY NOW" BUTTON
      });

      // Update document with new payment URL + fresh PDF URI
      const updatedDocs = allDocuments.map(d =>
        d.id === doc.id
          ? {
              ...d,
              paymentUrl: data.url,
              paymentStatus: 'pending',
              pdfUri: pdfResult.pdfUri,  // ← NEW PDF WITH BUTTON
            }
          : d
      );

      // Update state
      setAllDocuments(updatedDocs);
      setPaymentUrl(data.url);

      // === TRY BACKEND ===
      try {
        await fetch('https://hartman-estimate.vercel.app/api/save-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedDocs),
        });
        console.log('Payment link + updated PDF synced to backend');
      } catch (err) {
        console.warn('Backend sync failed — saved locally', err);
      }

      // === ALWAYS SAVE LOCALLY ===
      try {
        await AsyncStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
      } catch (err) {
        console.error('Local save failed after attaching payment link!', err);
        showMsg('Link attached but sync failed');
      }

      showMsg('Payment link attached! PDF updated with Pay Now button 🎉');

    } else {
      showMsg(`Failed: ${data.details || data.error || 'No payment URL returned'}`);
    }
  } catch (err) {
    console.error('Payment link generation error:', err);
    showMsg('Failed to attach payment link — try again');
  } finally {
    setIsGeneratingPayment(false);
  }
};

const pickFromContacts = async () => {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') {
    showMsg('Contacts permission denied');
    return;
  }

  try {
    const { data } = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.Name,
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Emails,
      ],
    });

    if (data.length === 0) {
      showMsg('No contacts found');
      return;
    }

    setPhoneContacts(data);
    setPhoneContactSearch('');
    setShowPhoneContactsPicker(true);
    setShowCustomerMenu(false); // close main menu
  } catch (err) {
    showMsg('Failed to load contacts');
    console.error(err);
  }
};

const getCurrencySymbol = () => {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'C$',
    AUD: 'A$',
    JPY: '¥',
    CHF: 'CHF',
    NZD: 'NZ$',
  };
  return symbols[selectedCurrency] || '$';
};
  
  const saveCustomerDatabase = async (list) => {
  await AsyncStorage.setItem('customerDatabase', JSON.stringify(list));
  setCustomerDatabase(list);
};
  
  // ONLY NEW CODE YOU NEED — 8 lines
const ensureItemInCurrentJob = (jobName, itemName, itemPrice) => {
  if (currentJob === jobName) {
    setItemsByJob(prev => ({
      ...prev,
      [jobName]: [...(prev[jobName] || []), { name: itemName, price: itemPrice, qty: 1 }]
    }));
  }
};

const handleSaveToHistoryWithPayment = async () => {
  setIsGeneratingPayment(true);

  try {
    const total = calculateGrandTotal();

    const result = await generateDocumentPdf({
      isInvoice: isInvoiceMode,
      invoiceNumber,
      customer: { ...customer },
      companyName,
      companyAddress,
      companyPhone,
      contractorEmail,
      logoUri,
      jobs: [...selectedJobs],
      itemsByJob: JSON.parse(JSON.stringify(itemsByJob)),
      notes,
      jobsitePhotos: [...jobsitePhotos],
      labor: {
        standardHours: parseFloat(standardHours) || 0,
        otHours: parseFloat(otHours) || 0,
        travelHours: parseFloat(travelHours) || 0,
      },
      rates: {
        standardRate: parseFloat(standardRate) || 0,
        otRate: parseFloat(otRate) || 0,
        travelRate: parseFloat(travelRate) || 0,
      },
      markupPercent: parseFloat(markupPercent) || 0,
      taxPercent: parseFloat(taxPercent || 0),
      grandTotalOverride: total,
    });

    // === DETERMINE CURRENT NUMBER & INCREMENT ===
    let currentNumber = invoiceNumber;

    if (isInvoiceMode) {
      const next = String(parseInt(invoiceNumber) + 1);
      await AsyncStorage.setItem('lastInvoiceNumber', invoiceNumber);
      setInvoiceNumber(next);
    }
    // Note: If you want separate estimate numbering here too, add it like in the main button

    // === CREATE FULL DOCUMENT ===
    const newDoc = {
      id: Date.now().toString(),
      type: isInvoiceMode ? 'invoice' : 'estimate',
      invoiceNumber: currentNumber,
      createdDate: new Date().toISOString(),
      dueDate: dueDate || null,
      status: isInvoiceMode ? 'unpaid' : null,
      pdfUri: result.pdfUri,
      amount: total,
      grandTotal: total,
      customer: { ...customer },
      customerName: customer.name?.trim() || 'Customer',
      jobs: [...selectedJobs],
      itemsByJob: JSON.parse(JSON.stringify(itemsByJob)),
      labor: { standardHours, otHours, travelHours },
      rates: { standardRate, otRate, travelRate },
      markupPercent: parseFloat(markupPercent) || 0,
      taxPercent: parseFloat(taxPercent || 0),
      notes: notes || '',
      jobsitePhotos: [...jobsitePhotos],
      logoUri: logoUri || null,
      paymentUrl: result.paymentUrl || null,
      paymentStatus: result.paymentUrl ? 'pending' : null,
    };

    // Update state — newest first
    const updatedDocs = [newDoc, ...allDocuments];
    setAllDocuments(updatedDocs);

    // === TRY BACKEND ===
    try {
      await fetch('https://hartman-estimate.vercel.app/api/save-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDocs),
      });
      console.log('Document synced to backend');
    } catch (err) {
      console.warn('Backend save failed — saved locally', err);
    }

    // === ALWAYS SAVE LOCALLY ===
    try {
      await AsyncStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
    } catch (err) {
      console.error('Local save failed!', err);
      showMsg('Saved to list but sync failed');
    }

    // === SUCCESS MESSAGE ===
    showMsg(
      `Saved successfully!${result.paymentUrl ? ' • Payment link attached' : ''}`
    );

    // Optional: show action sheet
    // setCurrentDocForActions(newDoc);
    // setTimeout(() => setShowDocumentActionSheet(true), 400);

  } catch (err) {
    console.error('Save failed:', err);
    showMsg('Save failed — check connection');
  } finally {
    setIsGeneratingPayment(false);
  }
};

const confirmSaveToHistory = () => {
  const total = calculateGrandTotal();
  const symbol = getCurrencySymbol();

  showConfirm({
    title: isInvoiceMode ? "Save Invoice?" : "Save Estimate?",
    message: `${isInvoiceMode ? `Invoice #${invoiceNumber}` : `Estimate #E-${invoiceNumber}`}\nCustomer: ${customer.name || '—'}\n\nTotal Amount: ${symbol}${total.toFixed(2)}`,
    confirmText: "Save to History",
    destructive: false,
    onConfirm: () => {
      handleSaveToHistoryWithPayment();
    },
    onCancel: () => {
      // Just close — no save
    },
    customContent: (
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <View style={{
          backgroundColor: darkMode ? '#166534' : '#ecfdf5',
          padding: 24,
          borderRadius: 24,
          borderWidth: 4,
          borderColor: '#10b981',
          width: '100%',
          alignItems: 'center',
        }}>
          <Ionicons
            name={isInvoiceMode ? "receipt" : "document-text-outline"}
            size={56}
            color="#10b981"
          />
          <Text style={{
            fontSize: 28,
            fontWeight: '900',
            color: darkMode ? '#86efac' : '#10b981',
            marginTop: 16,
          }}>
            {isInvoiceMode ? `Invoice #${invoiceNumber}` : `Estimate #E-${invoiceNumber}`}
          </Text>
          {customer.name ? (
            <Text style={{
              fontSize: 18,
              color: darkMode ? '#d1d5db' : '#374151',
              marginTop: 8,
              fontWeight: '600'
            }}>
              {customer.name}
            </Text>
          ) : null}
          <Text style={{
            fontSize: 36,
            fontWeight: '900',
            color: '#10b981',
            marginTop: 20,
            letterSpacing: 1
          }}>
            {symbol}{total.toFixed(2)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 16, marginTop: 32, width: '100%' }}>
          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: '#10b981',
              paddingVertical: 18,
              borderRadius: 20,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 12,
            }}
            onPress={() => {
              setShowConfirmModal(false);
              handleSaveToHistoryWithPayment();
            }}
          >
            <Ionicons name="save" size={28} color="white" />
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 19 }}>
              Save to History
            </Text>
          </TouchableOpacity>

          {/* CANCEL BUTTON — FIXED: Only closes modal */}
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: darkMode ? '#374151' : '#f1f5f9',
              paddingVertical: 18,
              borderRadius: 20,
              borderWidth: 3,
              borderColor: '#dc2626',
            }}
            onPress={() => {
              setShowConfirmModal(false);
            }}
          >
            <Text style={{ color: '#dc2626', fontWeight: '800', fontSize: 19, textAlign: 'center' }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  });
};

const placeholderColor = darkMode ? '#94a3b8' : '#6b7280'; // Soft gray — visible on both light/dark
const convertToInvoice = () => {
  showConfirm({
    title: "Convert to Invoice?",
    message: `Estimate #E-${doc.invoiceNumber}\n${doc.customerName || 'Customer'}\nAmount: ${getCurrencySymbol()}${doc.amount?.toFixed(2)}\n\nThe estimate will be archived.`,
    confirmText: "Convert & Archive Estimate",
    onConfirm: async () => {
      try {
        // 1. Archive the original estimate
        const archivedEstimate = { ...doc, archived: true };

        // 2. Create new invoice
        const newInvoice = {
          ...doc,
          id: Date.now().toString(),
          type: 'invoice',
          invoiceNumber: doc.invoiceNumber, // Keep same number
          originalEstimateId: doc.id,
          createdDate: new Date().toISOString(),
          status: 'unpaid',
          dueDate: null,
          archived: false,
        };

        // 3. Update list: replace estimate with archived + add invoice on top
        const updatedDocs = allDocuments.map(d =>
          d.id === doc.id ? archivedEstimate : d
        );
        updatedDocs.unshift(newInvoice); // newest first

        // Update state
        setAllDocuments(updatedDocs);

        // === TRY BACKEND ===
        try {
          await fetch('https://hartman-estimate.vercel.app/api/save-documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedDocs),
          });
          console.log('Convert to invoice synced to backend');
        } catch (err) {
          console.warn('Backend sync failed — saved locally', err);
        }

        // === ALWAYS SAVE LOCALLY ===
        try {
          await AsyncStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
        } catch (err) {
          console.error('Local save failed after convert!', err);
          showMsg('Converted in app, but sync failed');
        }

        // Success feedback
        Toast.show({
          type: 'success',
          text1: 'Converted!',
          text2: `Invoice #${doc.invoiceNumber} created • Estimate archived`,
        });

      } catch (err) {
        console.error('Convert to invoice failed:', err);
        showMsg('Conversion failed');
      }
    },
  });
};

  
  const pressAnim = (scaleValue) => {
  Animated.sequence([
    Animated.timing(scaleValue, {
      toValue: 0.95,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
  ]).start();
};


const markAsPaid = async (docId) => {
  try {
    // Update the document status to 'paid'
    const updatedDocs = allDocuments.map(d =>
      d.id === docId ? { ...d, status: 'paid' } : d
    );

    // Update state
    setAllDocuments(updatedDocs);

    // === TRY BACKEND ===
    try {
      await fetch('https://hartman-estimate.vercel.app/api/save-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDocs),
      });
      console.log('Marked as paid — synced to backend');
    } catch (err) {
      console.warn('Backend sync failed — saved locally only', err);
    }

    // === ALWAYS SAVE LOCALLY ===
    try {
      await AsyncStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
    } catch (err) {
      console.error('Local save failed after marking paid!', err);
      showMsg('Marked as paid in app, but sync failed');
      return;
    }

    // Success feedback
    showMsg('Marked as paid 💰');

  } catch (err) {
    console.error('Unexpected error marking as paid:', err);
    showMsg('Failed to mark as paid');
  }
};


const showBeautifulDocumentActions = (doc) => {
  if (!doc.pdfUri) return showMsg('No PDF saved');
  setPdfUri(doc.pdfUri);

  const filename = (doc.type === 'invoice'
    ? `Invoice_${doc.invoiceNumber || 'Unknown'}_${doc.customerName || 'Customer'}`
    : `Estimate_E-${doc.invoiceNumber || 'Unknown'}_${doc.customerName || 'Customer'}`
  ).replace(/[<>:"/\\|?*]/g, '_') + '.pdf';

  setShowConfirmModal(true);
  setConfirmModal({
    title: doc.type === 'invoice' 
      ? `Invoice #${doc.invoiceNumber || ''}` 
      : `Estimate #E-${doc.invoiceNumber || ''}`,
    message: "How would you like to open this file?",
    confirmText: null,
    destructive: false,
    onCancel: () => setShowConfirmModal(false),
    onConfirm: () => {}, // not used
    customContent: (
      <View style={{ gap: 12, marginTop: 16 }}>
        {[
          { icon: "share-social", color: "#6366f1", text: "Share", action: () => { setShowConfirmModal(false); Sharing.shareAsync(doc.pdfUri); } },
         { icon: "print", color: "#f59e0b", text: "View/Print", action: () => { setShowConfirmModal(false); printPDF(doc.pdfUri); } },
          { icon: "download", color: "#dc2626", text: "Save to device…", action: async () => {
            setShowConfirmModal(false);
            try {
              const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
              if (!result.granted) return showMsg('Permission denied');

              const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                result.directoryUri,
                filename,
                'application/pdf'
              );

              const base64 = await FileSystem.readAsStringAsync(doc.pdfUri, {
                encoding: FileSystem.EncodingType.Base64,
              });

              await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
              });

              showMsg(`Saved as\n${filename.split('/').pop()}`);
            } catch (err) {
              showMsg('Save failed');
            }
          }},
        ].map((btn, i) => (
          <TouchableOpacity
            key={i}
            style={{
              backgroundColor: darkMode ? '#1f2937' : '#f8fafc',
              padding: 18,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              borderWidth: 2,
              borderColor: btn.color + '40',
              shadowColor: '#000',
              shadowOpacity: darkMode ? 0.4 : 0.1,
              shadowRadius: 8,
              elevation: 6,
            }}
            onPress={() => {
              btn.action();
            }}
          >
            <Ionicons name={btn.icon} size={28} color={btn.color} />
            <Text style={{ 
              fontSize: 18, 
              fontWeight: '600', 
              color: darkMode ? '#e5e7eb' : '#1f2937', 
              flex: 1 
            }}>
              {btn.text}
            </Text>
            <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
          </TouchableOpacity>
        ))}
      </View>
    ),
  });
};


const deleteDocument = async (docId) => {
  try {
    // Remove the document from the list
    const updatedDocs = allDocuments.filter(d => d.id !== docId);

    // Update state immediately
    setAllDocuments(updatedDocs);

    // === TRY BACKEND ===
    try {
      await fetch('https://hartman-estimate.vercel.app/api/save-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDocs),
      });
      console.log('Document deleted — synced to backend');
    } catch (err) {
      console.warn('Backend delete sync failed — saved locally', err);
    }

    // === ALWAYS SAVE LOCALLY (critical for reliability) ===
    try {
      await AsyncStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
    } catch (err) {
      console.error('Local save failed after delete!', err);
      showMsg('Deleted from list, but sync failed');
      return;
    }

    // Success feedback & cleanup
    showMsg('Document deleted 🗑️');
    setShowDeleteDocConfirm(false);
    setDocToDelete(null);

  } catch (err) {
    console.error('Unexpected error deleting document:', err);
    showMsg('Delete failed');
  }
};
  
  const showQuickMsg = (msg) => {
  const id = Date.now();
  setQuickMessage({ text: msg, id });

  toastAnim.setValue(0.95);
  Animated.spring(toastAnim, {
    toValue: 1,
    friction: 8,
    tension: 100,
    useNativeDriver: true,
  }).start();

  // Auto-hide after 2.8 seconds
  setTimeout(() => {
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setQuickMessage(prev => prev?.id === id ? null : prev);
    });
  }, 2800);
};
  
  
  
  
 const toastConfig = {
 
 
  success: (props) => (
  
    <Animated.View
      style={{
        height: 64,
        width: '92%',
        backgroundColor: darkMode ? '#166534' : '#10b981',   // dark vs light green
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: darkMode ? 0.6 : 0.4,
        shadowRadius: 12,
        elevation: 20,
        zIndex: 99999,
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: darkMode ? '#22c55e' : '#86efac',
        // Inside the success toast style, replace transform with:
transform: [{ scale: toastAnim }]
      }}
    >
      <Icon 
        name="check-circle" 
        size={30} 
        color={darkMode ? '#86efac' : 'white'} 
      />
      <Text style={{ 
        color: 'white', 
        fontWeight: '800', 
        fontSize: 17, 
        marginLeft: 14,
        letterSpacing: 0.3,
      }}>
        {props.text1 || 'Success!'}
      </Text>
    </Animated.View>
  ),
  
  skull: ({ text1 }) => (
  <Animated.View style={{
    height: 60,
    width: '88%',
    backgroundColor: '#dc2626',           // exact red from job item delete
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 24,
    zIndex: 99999,
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    // NO BORDER — just like the real one
    transform: [{ scale: toastAnim }],
  }}>
    <Ionicons 
      name="skull" 
      size={30} 
      color="white" 
    />
    <Text style={{ 
      color: 'white', 
      fontWeight: '800', 
      fontSize: 17, 
      marginLeft: 14,
      letterSpacing: 0.4,
    }}>
      {text1}
    </Text>
  </Animated.View>
),

pdf_saved: ({ text1 }) => (
  <Animated.View style={{
    height: 80,
    width: '92%',
    backgroundColor: darkMode ? '#166534' : '#059669',   // emerald green
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: darkMode ? 0.7 : 0.5,
    shadowRadius: 20,
    elevation: 30,
    borderWidth: 3,
    borderColor: darkMode ? '#22c55e' : '#86efac',
    transform: [{ scale: toastAnim }],
  }}>
    <Ionicons name="checkmark-done-circle" size={40} color="white" />
    <View style={{ marginLeft: 16 }}>
      <Text style={{ 
        color: 'white', 
        fontWeight: '900', 
        fontSize: 20,
        letterSpacing: 0.5
      }}>
        {text1 || 'Saved to History!'}
      </Text>
      <Text style={{ 
        color: true,
        color: 'rgba(255,255,255,0.9)', 
        fontSize: 14, 
        marginTop: 2 
      }}>
        {isInvoiceMode ? 'Invoice' : 'Estimate'} ready to share or print
      </Text>
    </View>
  </Animated.View>
),
  
  // Add this inside your toastConfig (next to the success one)
invoice_mode: ({ text1, text2 }) => (
  <Animated.View style={{
    height: 70,
    width: '90%',
    backgroundColor: text2 === 'ON' 
      ? (darkMode ? '#7c2d12' : '#fb923c')   // warm orange when ON
      : (darkMode ? '#166534' : '#10b981'),  // green when OFF
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: darkMode ? 0.7 : 0.4,
    shadowRadius: 16,
    elevation: 30,
    zIndex: 99999,
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: text2 === 'ON' ? '#fdba74' : '#86efac',
    transform: [{ scale: toastAnim }],
  }}>
    <Icon 
      name="receipt-long" 
      size={34} 
      color="white" 
    />
    <View style={{ marginLeft: 16 }}>
      <Text style={{ 
        color: 'white', 
        fontWeight: '900',  
        fontSize: 19,
      }}>
        {text1}
      </Text>
      <Text style={{ 
        color: 'rgba(255,255,255,0.9)', 
        fontSize: 14, 
        fontWeight: '600',
        marginTop: 2,
      }}>
        Invoice Mode is now <Text style={{ fontWeight: '800' }}>{text2}</Text>
      </Text>
    </View>
  </Animated.View>
),
  
};
  
  // ────── INPUT FORMATTERS & VALIDATORS ──────
const formatPhone = (text) => {
  // Remove all non-digits
  const digits = text.replace(/\D/g, '');
  let formatted = '';

  if (digits.length >= 1) formatted = `(${digits.slice(0, 3)}`;
  if (digits.length >= 4) formatted += `) ${digits.slice(3, 6)}`;
  if (digits.length >= 7) formatted += `-${digits.slice(6, 10)}`;

  return formatted;
};

const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
};

const isValidPhone = (phone) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10;
};


 



useEffect(() => {
  if (customerModalMessage) {
    toastAnim.setValue(0);

    // Spring in (pop + grow)
    Animated.spring(toastAnim, {
      toValue: 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();

    // After 3 seconds, fade + collapse height
    const timer = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 500,  // Slightly longer for smooth slide-up feel
        useNativeDriver: true,
      }).start(() => {
        setCustomerModalMessage('');  // Optional: clear text after animation
      });
    }, 3000);

    return () => clearTimeout(timer);
  } else {
    toastAnim.setValue(0);
  }
}, [customerModalMessage]);

  

  
  
  // CLEAR ITEM SELECTION WHEN SLIDING PANEL CLOSES
useEffect(() => {
  if (!currentJob) {
    // Panel just closed → clear any leftover selection
    setSelectedItems({});
  }
}, [currentJob]);
  
  
  // AUTO-EXIT MULTI-SELECT WHEN NO ITEMS ARE SELECTED
useEffect(() => {
  const selectedCount = Object.keys(selectedItems).length;
  if (selectedCount === 0) {
    // Nothing selected → automatically exit multi-select mode
    // (this runs instantly when last item is deselected)
    // No need to do anything else — the delete bar will disappear because of the condition below
  }
}, [selectedItems]);
  
  // Auto-animate preview when Settings panel opens
useEffect(() => {
  if (showSettingsPanel) {
    // Small delay so it feels like a "reveal"
    const timer = setTimeout(() => triggerPreviewAnimation(), 150);
    return () => clearTimeout(timer);
  }
}, [showSettingsPanel]);

const scrollRef = useRef(null);
const toastAnim = useRef(new Animated.Value(1)).current; // Start visible

  
  // ADD THIS useEffect ONCE — anywhere in your App component
useEffect(() => {
  if (isTemplateMultiSelect && 
      Object.keys(selectedTemplates).every(key => !selectedTemplates[key])) {
    setIsTemplateMultiSelect(false);
  }
}, [selectedTemplates, isTemplateMultiSelect]);
  
  
// PULSE ANIMATION
const pulseAnim = useRef(new Animated.Value(1)).current;

useEffect(() => {
  let pulseCount = 0;
  const maxPulses = 3;

  const pulse = Animated.sequence([
    Animated.timing(pulseAnim, {
      toValue: 1.12,
      duration: 900,
      useNativeDriver: true,
    }),
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }),
  ]);

  const runPulse = () => {
    if (pulseCount < maxPulses) {
      pulseCount++;
      Animated.sequence([pulse]).start(runPulse);
    }
  };

  runPulse();

  return () => {
    pulseAnim.setValue(1); // Reset scale
  };
}, [pulseAnim]);

const [showContextMenu, setShowContextMenu] = useState(false);
const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
const [contextMenuCustomer, setContextMenuCustomer] = useState(null);
const [contextMenuIndex, setContextMenuIndex] = useState(-1);


const [phoneContacts, setPhoneContacts] = useState([]);
const [showPhoneContactsPicker, setShowPhoneContactsPicker] = useState(false);
const [phoneContactSearch, setPhoneContactSearch] = useState('');

const [showCustomerActionSheet, setShowCustomerActionSheet] = useState(false);
const [selectedCustomerForAction, setSelectedCustomerForAction] = useState(null);
const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);

const [isStripeConnected, setIsStripeConnected] = useState(false);

  
  // Tax Modal Vars
const [taxPercent, setTaxPercent] = useState('0');
const [tempTax, setTempTax] = useState('0');
const [showTax, setShowTax] = useState(false);

const [quickToast, setQuickToast] = useState(null);

const showQuickToast = (text) => {

  setQuickToast(text);
  setTimeout(() => {

    setQuickToast(null);
  }, 2000);
};

const [isPro, setIsPro] = useState(false);
const [proPackage, setProPackage] = useState(null);
const [offeringsLoading, setOfferingsLoading] = useState(true);

const [isSavingFile, setIsSavingFile] = useState(false);

  // DATABASE + PICKER
  const [showDatabase, setShowDatabase] = useState(false);
  const [globalItemSearch, setGlobalItemSearch] = useState('');
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showEditItemPicker, setShowEditItemPicker] = useState(false);

  // NEW: Edit global item + add default item to job type
  const [showEditGlobalItem, setShowEditGlobalItem] = useState(false);
  const [editGlobalItemIdx, setEditGlobalItemIdx] = useState(-1);
  const [editGlobalName, setEditGlobalName] = useState('');
  const [editGlobalPrice, setEditGlobalPrice] = useState('');
  const [showAddDefaultItem, setShowAddDefaultItem] = useState(false);
  
  
  const [showDocumentActionSheet, setShowDocumentActionSheet] = useState(false);
const [currentDocForActions, setCurrentDocForActions] = useState(null);
  
  const [showJobManager, setShowJobManager] = useState(false);   // ← NEW
  
  
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [hasNoLogo, setHasNoLogo] = useState(false);  // ← NEW
  
  // All default items from every job type (for display & deletion)
const allDefaultItems = Object.entries(JOB_TYPES).flatMap(([job, items]) =>
  items.map(item => ({ ...item, job }))
);

const [editingCustomerIndex, setEditingCustomerIndex] = useState(-1); // -1 = adding new, >=0 = editing existing
const [tempCustomer, setTempCustomer] = useState({ name: '', phone: '', email: '', address: '' }); // for edit/add form

  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
const [confirmModal, setConfirmModal] = useState({
  title: '',
  message: '',
  confirmText: '',
  destructive: false,
  onConfirm: () => {},
  onCancel: () => {},
});

// THE ONLY showConfirm YOU ARE ALLOWED TO HAVE — DELETE ALL OTHERS
const showConfirm = (options) => {
  const {
    title = '',
    message = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    destructive = false,
    onConfirm = () => {},
    onCancel = () => {},
    customContent = null,
  } = options;

  setConfirmModal({
    title,
    message,
    confirmText,
    cancelText,
    destructive,
    onConfirm: () => {
      setShowConfirmModal(false);
      onConfirm();
    },
    onCancel: () => {
      setShowConfirmModal(false);
      onCancel();
    },
    customContent,
  });

  setShowConfirmModal(true);
};




const selectedHistoryCount = Object.values(selectedHistoryIds).filter(Boolean).length;

const DEFAULT_COMPANY_NAME = "Default Electric, Inc";

const previewAnim = useRef(new Animated.Value(0)).current;

// ────── ADD THESE 4 LINES (FIXES THE ERROR) ──────
const invoiceScale  = useRef(new Animated.Value(1)).current;
const generateScale = useRef(new Animated.Value(1)).current;
const saveScale     = useRef(new Animated.Value(1)).current;
const clearScale    = useRef(new Animated.Value(1)).current;



//HELPER OVERLAY REFERENCE TAGS

const customerHelpRef = useRef(null);
const yourEmailRef = useRef(null);
const jobTypesRef = useRef(null);
const addItemsRef = useRef(null);
const quantityRef = useRef(null);
const generatePdfRef = useRef(null);
const sharePrintRef = useRef(null);
const saveTemplateRef = useRef(null);
const clearRef = useRef(null);
const photosRef = useRef(null);
const laborRef = useRef(null);
const notesRef = useRef(null);
const logoToggleRef = useRef(null);
const manageJobsBtnRef = useRef(null);
const markupTaxHelpRef = useRef(null);
const generatePdfHelpRef = useRef(null);

  const qtyInputRef = useRef(null);
  const priceInputRef = useRef(null);

// BEAUTIFUL PHONE FORMATTER — handles any input perfectly
const formatPhoneNumber = (text) => {
  // Remove everything except digits
  const digits = text.replace(/\D/g, '').slice(0, 10);

  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};


  const filteredGlobalItems = GLOBAL_ITEMS
    .filter(item => item.name.toLowerCase().includes(globalItemSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

const [quickMessage, setQuickMessage] = useState(null); // { text: string, id: number }


 const showMsg = (msg) => {
  // Reset animation
  toastAnim.setValue(0.95);
  
  Toast.show({
    type: 'success',
    text1: msg,
    position: 'top',
    topOffset: 60,
    visibilityTime: 2200,
    // Custom animation
    onShow: () => {
      Animated.spring(toastAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }).start();
    },
  });
};


const triggerPreviewAnimation = () => {
  previewAnim.setValue(0.95);     // ← This line was missing!
  Animated.spring(previewAnim, {
    toValue: 1,
    friction: 8,
    tension: 100,
    useNativeDriver: true,
  }).start();
};

// MASTER FUNCTION — EVERY ITEM ADDED GOES THROUGH THIS
const addItemEverywhere = async (itemName, itemPrice, targetJob = null, qty = 1) => {
  const name = itemName.trim();
  const price = parseFloat(itemPrice);
  const lowerName = name.toLowerCase();

  if (!name || isNaN(price) || price < 0) {
    showConfirm({
      title: "Invalid Input",
      message: "Please enter a valid name and price.",
      onConfirm: () => {},
    });
    return false;
  }

  // CHECK FOR DUPLICATE IN GLOBAL
  if (GLOBAL_ITEMS.some(i => i.name.toLowerCase() === lowerName)) {
    showConfirm({
      title: "Name Exists",
      message: `"${name}" is already in the Global Database.\n\nEdit it in Database → Global Items to change price.`,
      confirmText: "OK",
      onConfirm: () => {},
    });
    return false;
  }

  const newItem = { name, price };

  // 1. ADD TO GLOBAL DATABASE
  const updatedGlobal = [...GLOBAL_ITEMS, newItem];
  await saveGlobalItems(updatedGlobal);

  // 2. ADD TO JOB TYPE DEFAULTS (if we're editing a job's defaults)
  if (targetJob && JOB_TYPES[targetJob] !== undefined) {
    const currentDefaults = JOB_TYPES[targetJob] || [];
    
    // Prevent duplicate in this job type
    if (currentDefaults.some(i => i.name.toLowerCase() === lowerName)) {
      showConfirm({
        title: "Already Exists",
        message: `"${name}" is already a default item for ${targetJob}.`,
        onConfirm: () => {},
      });
      return false;
    }

    const updatedDefaults = [...currentDefaults, newItem];
    const updatedJobTypes = { ...JOB_TYPES, [targetJob]: updatedDefaults };
    await saveJobTypes(updatedJobTypes); // ← THIS WAS MISSING!
  }

  // 3. ADD TO CURRENT ESTIMATE (if this job is currently open)
  if (targetJob && currentJob === targetJob) {
    setItemsByJob(prev => ({
      ...prev,
      [targetJob]: [...(prev[targetJob] || []), { ...newItem, qty }]
    }));
  }

  // Clear inputs
  setNewItemName('');
  setNewItemQty('1');
  setNewItemPrice('');

  showMsg(`"${name}" added to Global + ${targetJob ? targetJob + ' defaults' : 'Global only'}`);
  return true;
};

  
  // NEW: Open item editor directly from Job Manager
const openJobItemsFromManager = (jobName) => {
  setCurrentJob(jobName);
  setItemsByJob(prev => ({
    ...prev,
    [jobName]: [...(JOB_TYPES[jobName] || []).map(item => ({ ...item, qty: 1 }))]
  }));
  setShowJobManager(false); // close manager
  // Don't show add-item modal — go straight to item list
};

const toggleJobFromManager = (jobName) => {
  const isCurrentlySelected = selectedJobs.includes(jobName);

  if (isCurrentlySelected) {
    // REMOVE from estimate
    setSelectedJobs(prev => prev.filter(j => j !== jobName));
    setItemsByJob(prev => {
      const updated = { ...prev };
      delete updated[jobName];
      return updated;
    });
    showMsg(`${jobName} removed from estimate`);
  } else {
    // ADD to estimate
    setSelectedJobs(prev => [...prev, jobName]);
    setItemsByJob(prev => ({
      ...prev,
      [jobName]: (JOB_TYPES[jobName] || []).map(item => ({ ...item, qty: 1 }))
    }));
    showMsg(`${jobName} added to estimate`);
  }


};

const addDefaultItemToJob = async (jobName, itemName, itemPrice) => {
  const name = itemName.trim();
  const price = parseFloat(itemPrice);

  if (!name || isNaN(price) || price < 0) {
    showConfirm({
      title: "Invalid Input",
      message: "Please enter a valid name and price.",
      onConfirm: () => {},
    });
    return false;
  }

  const lowerName = name.toLowerCase();

  // CHECK GLOBAL DUPLICATE
  if (GLOBAL_ITEMS.some(i => i.name.toLowerCase() === lowerName)) {
    showConfirm({
      title: "Name Already Exists",
      message: `"${name}" is already in the Global Database.\n\nEdit it in Database → Global Items to change price.`,
      onConfirm: () => {},
    });
    return false;
  }

  const newItem = { name, price };

  // ADD TO GLOBAL (always)
  await saveGlobalItems([...GLOBAL_ITEMS, newItem]);

  // ONLY add to job defaults if jobName is a real string
  if (jobName && typeof jobName === 'string' && jobName.trim() !== '') {
    const currentDefaults = JOB_TYPES[jobName] || [];
    
    // Prevent duplicate in this job's defaults
    if (currentDefaults.some(i => i.name.toLowerCase() === lowerName)) {
      showConfirm({
        title: "Already a Default",
        message: `"${name}" is already a default item for ${jobName}.`,
        onConfirm: () => {},
      });
      return false;
    }

    const updatedDefaults = [...currentDefaults, newItem];
    const updatedJobTypes = { ...JOB_TYPES, [jobName]: updatedDefaults };
    await saveJobTypes(updatedJobTypes);

    // Add to current estimate if this job is open
    if (currentJob === jobName) {
      setItemsByJob(prev => ({
        ...prev,
        [jobName]: [...(prev[jobName] || []), { ...newItem, qty: 1 }]
      }));
    }

    showMsg(`"${name}" added to ${jobName} defaults + Global`);
  } else {
    showMsg(`"${name}" added to Global Database only`);
  }

  return true;
};

  const toggleDarkMode = () => {
  const mode = !darkMode;
  setDarkMode(mode);
  // Save in the background — no need to await, it's not critical for the toggle
  AsyncStorage.setItem('darkMode', String(mode)).catch(err => {
    console.warn('Failed to save dark mode preference', err);
  });
};
 

const pickLogo = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'image/svg+xml'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.type === 'cancel') return;

    if (!result.assets?.[0]) {
      showMsg('No image selected');
      return;
    }

    const { uri } = result.assets[0];

    showMsg('Optimizing logo...');

    // MAGIC: Resize + crop to perfect 1024x1024 square, preserve transparency
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [
        { resize: { width: 1024, height: 1024 } },
        // This forces center crop if not square
        { resize: { width: 1024 } },
      ],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.PNG, // Keeps transparency!
        base64: false,
      }
    );

    const finalUri = manipResult.uri;

    // Optional: Show final size
    const fileInfo = await FileSystem.getInfoAsync(finalUri);
    console.log('Final logo size:', (fileInfo.size / 1024).toFixed(1), 'KB');

    setLogoUri(finalUri);
    setHasNoLogo(false);
    triggerPreviewAnimation();
    await AsyncStorage.setItem('logoUri', finalUri);
    await AsyncStorage.setItem('hasNoLogo', 'false');

    Toast.show({
      type: 'success',
      text1: 'Logo Updated!',
      text2: 'Perfectly sized & optimized',
    });

  } catch (err) {
    console.error('Logo picker error:', err);
    showMsg('Failed to process logo');
  }
};

// Save when currency changes
useEffect(() => {
  if (selectedCurrency !== null) {
    AsyncStorage.setItem('selectedCurrency', selectedCurrency);
  }
}, [selectedCurrency]);

// Load once on app start
useEffect(() => {
  const loadCurrency = async () => {
    try {
      const saved = await AsyncStorage.getItem('selectedCurrency');
      if (saved) {
        setSelectedCurrency(saved);
      } else {
        setSelectedCurrency('USD');  // Only default if nothing saved
      }
    } catch (e) {
      setSelectedCurrency('USD');
    }
  };
  loadCurrency();
}, []);
// AUTO-EXIT MULTI-SELECT WHEN NOTHING IS SELECTED
useEffect(() => {
  if (isHistoryMultiSelect && selectedHistoryCount === 0) {
    setIsHistoryMultiSelect(false);
  }
}, [isHistoryMultiSelect, selectedHistoryCount]);

// SPLASH TIMER
useEffect(() => {
  const timer = setTimeout(() => setShowSplash(false), 1000);
  return () => clearTimeout(timer);
}, []);

useEffect(() => {
  const loadData = async () => {
    let loadedDocs = [];
    // STEP 1: Try backend first
    try {
      const response = await fetch('https://hartman-estimate.vercel.app/api/save-documents');
      if (response.ok) {
        const data = await response.json();
        // Safe extraction: handles { documents: [...] } or raw array
        const documents = data.documents || data || [];
        if (Array.isArray(documents)) {
          loadedDocs = documents;
          await AsyncStorage.setItem('allDocuments', JSON.stringify(documents));
        }
      }
    } catch (err) {
      console.warn('Backend load failed, will use local', err);
    }
    // STEP 2: If backend failed or returned nothing, fall back to local
    if (loadedDocs.length === 0) {
      try {
        const local = await AsyncStorage.getItem('allDocuments');
        if (local) {
          loadedDocs = JSON.parse(local);
        }
      } catch (err) {
        console.error('Failed to parse local documents', err);
      }
    }
    // === THE MISSING LINE ===
    setAllDocuments(loadedDocs);
    // === LOCAL SETTINGS (keep these in AsyncStorage) ===
    const savedCustomers = await AsyncStorage.getItem('customerDatabase');
    if (savedCustomers) setCustomerDatabase(JSON.parse(savedCustomers));
    const lastInv = await AsyncStorage.getItem('lastInvoiceNumber');
    if (lastInv) {
      setInvoiceNumber(String(parseInt(lastInv) + 1));
    } else {
      setInvoiceNumber('1001');
    }
    const addr = await AsyncStorage.getItem('companyAddress');
    if (addr) setCompanyAddress(addr);
    const phone = await AsyncStorage.getItem('companyPhone');
    if (phone) setCompanyPhone(phone);
    const logo = await AsyncStorage.getItem('logoUri');
    const email = await AsyncStorage.getItem('contractorEmail');
    if (email) setContractorEmail(email);
    const noLogo = await AsyncStorage.getItem('hasNoLogo');
    if (noLogo === 'true') {
      setHasNoLogo(true);
      setLogoUri(null);
    } else if (logo) {
      setHasNoLogo(false);
      setLogoUri(logo);
    } else {
      setHasNoLogo(false);
      setLogoUri(null);
    }
    const name = await AsyncStorage.getItem('companyName');
    if (name) setCompanyName(name);
    const markup = await AsyncStorage.getItem('markupPercent');
    if (markup) setMarkupPercent(markup);
    const tax = await AsyncStorage.getItem('taxPercent');
    if (tax) setTaxPercent(tax);
    const travel = await AsyncStorage.getItem('travelRate');
    if (travel) setTravelRate(travel);
    const otRate = await AsyncStorage.getItem('otRate');
    if (otRate) setOtRate(otRate);
    const standardRate = await AsyncStorage.getItem('standardRate');
    if (standardRate) setStandardRate(standardRate);
    const dark = await AsyncStorage.getItem('darkMode');
    if (dark === 'true') setDarkMode(true);
    const temps = await AsyncStorage.getItem('userTemplates');
    if (temps) setTEMPLATES(JSON.parse(temps));
    const items = await AsyncStorage.getItem('globalItems');
    if (items) setGLOBAL_ITEMS(JSON.parse(items));
    const jobData = await AsyncStorage.getItem('userJobTypes');
    if (jobData) {
      const parsed = JSON.parse(jobData);
      if (Array.isArray(parsed)) {
        const migrated = {};
        parsed.forEach(job => (migrated[job] = []));
        setJOB_TYPES(migrated);
        await AsyncStorage.setItem('userJobTypes', JSON.stringify(migrated));
      } else {
        setJOB_TYPES(parsed);
      }
    } else {
      setJOB_TYPES({});
    }
  };
  loadData();
}, []);



  const saveGlobalItems = async (items) => {
    await AsyncStorage.setItem('globalItems', JSON.stringify(items));
    setGLOBAL_ITEMS(items);
  };

  const saveJobTypes = async (obj) => {
    await AsyncStorage.setItem('userJobTypes', JSON.stringify(obj));
    setJOB_TYPES(obj);
  };
  
  

  const addJob = async () => {
    const name = newJobName.trim();
    if (!name || name in JOB_TYPES) {
      Alert.alert('Error', 'Name exists or empty');
      return;
    }
    const updated = { ...JOB_TYPES, [name]: [] };
    await saveJobTypes(updated);
    setSelectedJobs(j => [...j, name]);
    setItemsByJob(i => ({ ...i, [name]: [] }));
    setNewJobName('');
    setShowAddJob(false);
    showMsg('Job type added');
  };

  const editJob = async () => {
    const oldName = editJobOld;
    const newName = editJobNew.trim();
    if (!newName || newName === oldName) {
      setShowEditJob(false);
      return;
    }
    if (newName in JOB_TYPES) {
      Alert.alert('Error', 'Name already exists');
      return;
    }
    const updated = { ...JOB_TYPES };
    updated[newName] = updated[oldName];
    delete updated[oldName];
    await saveJobTypes(updated);

    setSelectedJobs(j => j.map(x => (x === oldName ? newName : x)));
    setItemsByJob(i => {
      if (i[oldName]) {
        i[newName] = i[oldName];
        delete i[oldName];
      }
      return { ...i };
    });

    setShowEditJob(false);
    showMsg('Job type renamed');
  };





 const toggleJob = (type) => {
  setSelectedJobs(prev => {
    const isSelected = prev.includes(type);

    if (isSelected) {
      // Deselect: remove from estimate
      return prev.filter(x => x !== type);
    } else {
      // Select: REPLACE any existing instance with fresh defaults
      const filtered = prev.filter(x => x !== type); // remove old
      const newJobs = [...filtered, type];
      
      // LOAD DEFAULT ITEMS FROM JOB_TYPES[type]
      const defaultItems = (JOB_TYPES[type] || []).map(item => ({
        ...item,
        qty: 1
      }));

      setItemsByJob(cur => ({
        ...cur,
        [type]: (JOB_TYPES[type] || []).map(item => ({ ...item, qty: 1 }))
      }));

      return newJobs;
    }
  });
};

  const deleteSelectedJobs = () => {
    if (selectedJobs.length === 0) return;
    setShowDeleteJobsConfirm(true);
  };

const confirmDeleteJobs = () => {
  if (selectedJobs.length === 0) return;

  // Force a mutable copy — this breaks the frozen state
  const newJobTypes = JSON.parse(JSON.stringify(JOB_TYPES));

  let deletedCount = 0;
  selectedJobs.forEach(job => {
    if (newJobTypes.hasOwnProperty(job)) {
      delete newJobTypes[job];
      deletedCount++;
    }
  });

  // Save the clean mutable object
  saveJobTypes(newJobTypes);

  // Clear from current estimate
  setItemsByJob(prev => {
    const updated = { ...prev };
    selectedJobs.forEach(job => delete updated[job]);
    return updated;
  });

  setSelectedJobs([]);
  setShowDeleteJobsConfirm(false);
  showMsg(`${deletedCount} job${deletedCount > 1 ? 's' : ''} deleted`);
};

  const toggleItem = (job, idx) => {
    const key = `${job}-${idx}`;
    setSelectedItems(s => ({ ...s, [key]: !s[key] }));
  };

  const deleteSelectedItems = async (job) => {
  setItemsByJob(prev => {
    const updated = { ...prev };
    if (updated[job]) {
      updated[job] = updated[job].filter((_, idx) => !selectedItems[`${job}-${idx}`]);
    }
    return updated;
  });

  setSelectedItems(prev => {
    const updated = { ...prev };
    Object.keys(updated).forEach(key => {
      if (key.startsWith(`${job}-`)) delete updated[key];
    });
    return updated;
  });

  // Save to database
  const updatedJobTypes = { ...JOB_TYPES };
  if (updatedJobTypes[job]) {
    updatedJobTypes[job] = updatedJobTypes[job].filter((_, idx) => !selectedItems[`${job}-${idx}`]);
    await AsyncStorage.setItem('jobTypes', JSON.stringify(updatedJobTypes));
    setJOB_TYPES(updatedJobTypes);
  }

  showMsg('Items deleted');
};

const confirmDeleteItems = () => {
  const job = itemDeleteJob;
  const currentItems = itemsByJob[job] || [];

  // Get indices of selected items (in descending order to avoid index shift)
  const selectedIndices = Object.keys(selectedItems)
    .filter(k => k.startsWith(`${job}-`) && selectedItems[k])
    .map(k => parseInt(k.split('-')[1]))
    .sort((a, b) => b - a); // ← Descending: delete from end

  if (selectedIndices.length === 0) return;

  // Remove from end to front
  const newItems = [...currentItems];
  selectedIndices.forEach(idx => {
    newItems.splice(idx, 1);
  });

  setItemsByJob(i => ({ ...i, [job]: newItems }));
  setSelectedItems(s => {
    const u = { ...s };
    selectedIndices.forEach(idx => delete u[`${job}-${idx}`]);
    return u;
  });

  setShowItemDeleteConfirm(false);
  showMsg(`${selectedIndices.length} item${selectedIndices.length > 1 ? 's' : ''} deleted`);
};

  const addItem = async () => {
  const qty = parseInt(newItemQty) || 1;
  const price = parseFloat(newItemPrice) || 0;

  if (!newItemName?.trim() || price < 0) {
    showConfirm({ title: "Invalid", message: "Fill all fields", confirmText: "OK", onConfirm: () => {} });
    return;
  }

  const success = await addItemEverywhere(newItemName, newItemPrice, currentJob, qty);
  if (success) {
    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('');
    setShowAddItem(false);
  }
};

  const editItem = () => {
    const qty = parseInt(editItemQty);
    const price = parseFloat(editItemPrice);
    if (!editItemName || isNaN(qty) || isNaN(price)) {
      Alert.alert('Invalid Input', 'Fill all fields correctly.');
      return;
    }
    const list = [...itemsByJob[editItemJob]];
    if (list.filter((_, i) => i !== editItemIdx).some(i => i.name === editItemName)) {
      Alert.alert('Error', 'Item name already exists.');
      return;
    }
    list[editItemIdx] = { name: editItemName, qty, price };
    setItemsByJob(i => ({ ...i, [editItemJob]: list }));
    if (!GLOBAL_ITEMS.some(it => it.name === editItemName)) {
      saveGlobalItems([...GLOBAL_ITEMS, { name: editItemName, price }]);
    }
    setShowEditItem(false);
    showMsg('Updated');
  };

const saveLabor = async () => {
  // Parse the current temp values (whatever the user just edited)
  const hours = parseFloat(
    selectedLaborType === 'standard' ? tempSH :
    selectedLaborType === 'ot' ? tempOH : tempTH
  ) || 0;

  const rate = parseFloat(
    selectedLaborType === 'standard' ? tempSR :
    selectedLaborType === 'ot' ? tempOR : tempTR
  ) || 0;

  // Update the main state based on selected type
  if (selectedLaborType === 'standard') {
    setStandardHours(String(hours));
    setStandardRate(String(rate));
  } else if (selectedLaborType === 'ot') {
    setOtHours(String(hours));
    setOtRate(String(rate));
  } else if (selectedLaborType === 'travel') {
    setTravelHours(String(hours));
    setTravelRate(String(rate));
  }

  // Optional: Save to AsyncStorage (your existing logic)
  try {
    await AsyncStorage.setItem('standardHours', standardHours);
    await AsyncStorage.setItem('otHours', otHours);
    await AsyncStorage.setItem('travelHours', travelHours);
    await AsyncStorage.setItem('standardRate', standardRate);
    await AsyncStorage.setItem('otRate', otRate);
    await AsyncStorage.setItem('travelRate', travelRate);
    // Add currency if you're saving per-currency later
  } catch (err) {
    console.warn('Failed to save labor rates', err);
  }

  setShowLabor(false);
  showMsg('Labor updated');
};
const saveTax = async () => {
  const val = parseFloat(tempTax);
  if (isNaN(val) || val < 0) {
    Alert.alert('Invalid Tax', 'Please enter a valid number (e.g. 8.25)');
    return;
  }
  const cleanVal = String(val);
  setTaxPercent(cleanVal);
  await AsyncStorage.setItem('taxPercent', cleanVal);
  setShowTax(false);
  showMsg('Tax saved');
};

  const saveMarkup = async () => {
    const val = parseFloat(tempMarkup);
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid Markup', 'Markup must be non-negative.');
      return;
    }
    setMarkupPercent(String(val));
    await AsyncStorage.setItem('markupPercent', String(val));
    setShowMarkup(false);
    showMsg('Markup updated');
  };

  const loadTemplate = (name) => {
  const t = TEMPLATES[name];
  if (!t) return;

  // === FULL RESET FIRST – THIS IS CRITICAL ===
  setCustomer({ name: '', phone: '', email: '', address: '' });
  setSelectedJobs([]);
  setItemsByJob({});
  setSelectedItems({});
  setStandardHours('');
  setOtHours('');
  setTravelHours('');
  setNotes('');
  setJobsitePhotos([]);                    // ← FIX #1: Clear old photos
                 // ← FIX #3: Reset tax (or use your default)

  // Optional: Also clear labor rates if you want fully clean slate
  // setStandardRate('105'); setOtRate('157.5'); setTravelRate('105');

  // === NOW LOAD FROM TEMPLATE ===
  setCustomer({
    name: t.customer?.name || '',
    phone: t.customer?.phone || '',
    email: t.customer?.email || '',
    address: t.customer?.address || ''
  });

  setStandardHours(t.standardHours || '');
  setOtHours(t.otHours || '');
  setTravelHours(t.travelHours || '');
  setNotes(t.notes || '');
  
  
  

  // Load jobs & items
  const templateJobKeys = Object.keys(t).filter(k => Array.isArray(t[k]));

  const mergedItemsByJob = {};
  templateJobKeys.forEach(job => {
    mergedItemsByJob[job] = [...(t[job] || [])];
  });

  setSelectedJobs(templateJobKeys);
  setItemsByJob(mergedItemsByJob);

  // Ensure job types exist
  const updatedJobTypes = { ...JOB_TYPES };
  templateJobKeys.forEach(j => {
    if (!(j in updatedJobTypes)) updatedJobTypes[j] = [];
  });
  saveJobTypes(updatedJobTypes);

  setShowTemplates(false);
  setSelectedTemplate(null);
  showMsg('Draft loaded – continue...');
};

const deleteTemplate = async (names) => {
  // Accept single name (string) OR array of names
  const namesToDelete = Array.isArray(names) ? names : [names];

  // Make a copy and remove all selected templates
  const newTemps = { ...TEMPLATES };
  let deletedCount = 0;

  namesToDelete.forEach(name => {
    if (newTemps[name]) {
      delete newTemps[name];
      deletedCount++;
      // If the currently loaded template is being deleted, clear it
      if (selectedTemplate === name) {
        setSelectedTemplate(null);
      }
    }
  });

  // Save to storage
  await AsyncStorage.setItem('userTemplates', JSON.stringify(newTemps));
  setTEMPLATES(newTemps);

  // Show correct message
  if (deletedCount > 0) {
    showMsg(`${deletedCount} job${deletedCount > 1 ? 's' : ''} deleted`);
  }
};

const saveCurrentTemplate = async () => {
  const defaultName = customer.name.trim() || 'Estimate';
  const name = templateName.trim() || defaultName;

  if (!name) {
    Alert.alert('Invalid Name', 'Please enter a template name.');
    return;
  }

  const buildTemplateData = () => ({
    customer,
    standardHours,
    otHours,
    travelHours,
    ...Object.fromEntries(selectedJobs.map(job => [job, itemsByJob[job] || []]))
  });

  const exists = !!TEMPLATES[name];

  if (exists) {
    Alert.alert(
      'Draft Exists',
      `Update "${name}" with current estimate?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            const data = buildTemplateData();
            const newTemps = { ...TEMPLATES, [name]: data };
            await AsyncStorage.setItem('userTemplates', JSON.stringify(newTemps));
            setTEMPLATES(() => newTemps); // ← functional update
            setShowSaveTemplate(false);
            setTemplateName('');
            showMsg('Draft updated');
          }
        },
        {
          text: 'New Name',
          onPress: () => {
            setTemplateName('');
            setShowSaveTemplate(true);
          }
        }
      ],
      { cancelable: false }
    );
  } else {
    const data = buildTemplateData();
    const newTemps = { ...TEMPLATES, [name]: data };
    await AsyncStorage.setItem('userTemplates', JSON.stringify(newTemps));
    setTEMPLATES(() => newTemps); // ← functional update
    setShowSaveTemplate(false);
    setTemplateName('');
    showMsg('Draft saved');
  }
};

  const clearEstimate = () => setShowClearConfirm(true);

  const confirmClearEstimate = async () => {
  setCustomer({ name: '', phone: '', email: '', address: '' });
  setSelectedJobs([]);     // Clears selected jobs from estimate
  setItemsByJob({});       // Clears all items
  setSelectedItems({});
  setStandardHours('');
  setOtHours('');
  setNotes('');
  setTravelHours('');

  setJobsitePhotos([]);

  await AsyncStorage.multiRemove(['jobsitePhotos']);

  setShowClearConfirm(false);
  showMsg('Estimate cleared');
};

  const addJobsitePhoto = async () => {
  // 1. Permission
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Needed', 'Allow camera access to take photos');
    return;
  }

  try {
    // THIS EXACT CONFIG IS THE MAGIC (allowsEditing: false = no reload!)
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,   // ← THIS stops the full reload on Android
      quality: 0.7,
      exif: false,
    });

    // New Expo format – MUST check this first
    if (result.canceled) {
      return; // user backed out
    }

    // THE FIX FOR THE URI ERROR – Expo now returns an object, not a string
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      showMsg('Photo failed – try again');
      return;
    }

    // Store as a plain string (what your Image component expects)
    const uri = typeof asset.uri === 'string' ? asset.uri : asset.uri.toString();

    setJobsitePhotos(prev => [...prev, uri]);  // ← plain string
    showMsg('Photo added');

  } catch (error) {
    console.log('Camera error:', error);
    showMsg('Camera failed');
  }
};

  const removeJobsitePhoto = async (index) => {
    const newPhotos = jobsitePhotos.filter((_, i) => i !== index);
    setJobsitePhotos(newPhotos);
    
    showMsg('Photo removed');
  };
  
  const pickJobsitePhotosFromGallery = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Please allow photo library access.');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,   // ← use All instead of Images
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: 0,
    allowsEditing: false,
  });

  if (!result.canceled && result.assets?.length > 0) {
    // Filter only images (because All includes videos)
    const imageUris = result.assets
      .filter(asset => asset.type === 'image' || asset.mediaType === 'image')
      .map(asset => asset.uri);

    if (imageUris.length > 0) {
      const updatedPhotos = [...jobsitePhotos, ...imageUris];
      setJobsitePhotos(updatedPhotos);
      showMsg(`${imageUris.length} photo${imageUris.length > 1 ? 's' : ''} added from gallery`);
    }
  }
};


const handleGeneratePDF = async () => {
  try {
    setShowPreview(false);     // hide old preview if open
    setPdfUri(null);          // clear old pdf
    await generatePDF();      // ← now properly awaited with try/catch
  } catch (err) {
    console.error('PDF generation failed:', err);
    Alert.alert('Error', 'Failed to generate PDF. Please try again.');
  }
};

 
  
  const sendPDF = async () => {
    if (!pdfUri) return;
    const fileName = `${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}_Estimate.pdf`;
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({ from: pdfUri, to: newUri });
    await Sharing.shareAsync(newUri);
    setShowPreview(false);
    setPdfUri(null);
  };

  const allItems = selectedJobs.flatMap(j => (itemsByJob[j] || []).map(i => ({ ...i, job: j })));
  const subtotal = allItems.reduce((s, i) => s + i.qty * i.price, 0);
  const markupTotal = subtotal * (1 + (parseFloat(markupPercent) || 0) / 100);
  const standardTotal = (parseFloat(standardHours) || 0) * (parseFloat(standardRate) || 0);
  const otTotal = (parseFloat(otHours) || 0) * (parseFloat(otRate) || 0);
  const travelTotal = (parseFloat(travelHours) || 0) * (parseFloat(travelRate) || 0);
  const laborTotal = standardTotal + otTotal + travelTotal;
  const grandTotal = markupTotal + laborTotal;
  const taxAmount = markupTotal * ((parseFloat(taxPercent) || 0) / 100);
  

  
  // REUSABLE CLOSE BUTTON
const ModalCloseButton = ({ onPress }) => (
  <TouchableOpacity
    style={styles.modalCloseBtn}
    onPress={onPress}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Text style={styles.modalCloseText}>Close</Text>
  </TouchableOpacity>
);
  

 if (showSplash) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' }}>
      <Image 
        source={APP_LOGO} 
        style={{ width: 200, height: 120 }} 
        resizeMode="contain" 
      />
      <Text style={{ fontSize: 28, fontWeight: 'bold', marginTop: 20, color: '#00000' }}>
        {APP_NAME}
      </Text>
      <Text style={{ fontSize: 16, color: '#666', marginTop: 10 }}>Loading...</Text>
    </SafeAreaView>
  );
}

return (
<GestureHandlerRootView style={{ flex: 1 }}>
    <Host>
      <SafeAreaView style={{ flex: 1, backgroundColor: darkMode ? '#111827' : '#f8fafc' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
    
   
   {/* FINAL HEADER — NO EMPTY SPACE ABOVE, PERFECT CENTERING */}
    <View style={{ flexDirection: 'row', alignItems: 'center'}}>
<View style={{
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 60,
  backgroundColor: darkMode ? '#111827' : '#ffffff',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-evenly',
  paddingHorizontal: 20,
  // Removed paddingTop completely — SafeArea handles it now
  borderBottomWidth: 1,
  borderBottomColor: darkMode ? '#374151' : '#e2e8f0',
  zIndex: 99999,
  elevation: 0,
  
}}>

  
 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
  <TouchableOpacity onPress={() => setShowSettingsPanel(true)}>
    <HartmanLogo
      width={40}
      height={40}
      helpMode={helpMode}
      darkMode={darkMode}
    />
  </TouchableOpacity>
  
  
  
  {/* Settings icon removed — logic now on logo */}
</View>

<Animated.View style={{ transform: [{ scale: invoiceScale }] }}>
  <TouchableOpacity
    activeOpacity={1}
    onPressIn={() => pressAnim(invoiceScale)}
    onPress={() => {
      const newMode = !isInvoiceMode;
      setIsInvoiceMode(newMode);
      Toast.show({
        type: 'invoice_mode',
        text1: newMode ? 'Invoice Mode' : 'Estimate Mode',
        text2: newMode ? 'ON' : 'OFF',
        visibilityTime: 2000,
        onShow: () => {
          toastAnim.setValue(0.93);
          Animated.spring(toastAnim, {
            toValue: 1,
            friction: 7,
            tension: 120,
            useNativeDriver: true,
          }).start();
        },
      });
    }}
    style={{
      width: 42,                   
      height: 42,
      borderRadius: 36,       
      backgroundColor: isInvoiceMode 
        ? '#fefce8' 
        : (darkMode ? '#1e293b' : '#f1f5f9'),
      justifyContent: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 4,
      borderColor: isInvoiceMode ? '#fCD34D' : 'transparent',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    }}
  >
    <Icon 
      name="receipt-long" 
      size={28} 
      color={isInvoiceMode ? '#92400e' : (darkMode ? '#94a3b8' : '#4b5563')} 
    />
  </TouchableOpacity>
</Animated.View>

{/* Stripe Connect / Disconnect Button with Dropdown */}
<View style={{ position: 'relative' }}>

  {/* Button with Celebration Animation */}
  <Animated.View style={{
    transform: [
      { scale: connectAnim },
      { rotate: connectAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
    ],
  }}>
  
  
  
  <GestureTouchableOpacity
  style={{
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: isStripeConnected
      ? '#10b981' // Green when connected
      : (darkMode ? '#374151' : '#f1f5f9'), // Gray when not
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: isStripeConnected ? 0 : 3,
    borderColor: '#635bff',
  }}
  onPress={() => {
    if (!isPro) {
      setShowPaywall(true);
      showQuickToast('Stripe payments are a Pro feature');
      return;
    }
    if (isStripeConnected) {
      connectAnim.setValue(1);
      Animated.sequence([
        Animated.spring(connectAnim, { toValue: 1.15, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.spring(connectAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      ]).start();
      setShowDisconnectMenu(true);
    } else {
      const clientId = 'ca_Td84AN3WWsoqlUNxi5iOafDNFSAtjX5c';
      const redirectUri = 'https://hartman-estimate.vercel.app/api/stripe-callback';
      const authUrl = `https://connect.stripe.com/oauth/authorize`
        + `?response_type=code`
        + `&client_id=${clientId}`
        + `&scope=read_write`
        + `&redirect_uri=${encodeURIComponent(redirectUri)}`
        + `&state=hartman_estimate_v1`;
      Linking.openURL(authUrl).catch(() => {
        showQuickToast('Unable to open browser');
      });
    }
  }}
>
  <Ionicons
    name="card-outline"
    size={28}
    color={isStripeConnected ? 'white' : (darkMode ? '#e5e7eb' : '#1f2937')}
  />

  {/* Small green indicator dot when connected */}
  {isStripeConnected && (
    <View style={{
      position: 'absolute',
      top: 6,
      right: 6,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#86efac',
      borderWidth: 2,
      borderColor: '#ffffff',
    }} />
  )}
</GestureTouchableOpacity>
  </Animated.View>

  {/* Disconnect Dropdown */}
 {showDisconnectMenu && (
  <View style={{
    position: 'absolute',
    top: 52,
    left: -70,                        // ← Key fix: shifts left to center under button
                                      //     (42px button width → center at ~ -70 to -80)
    width: 180,
    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
    borderWidth: 1,
    borderColor: darkMode ? '#374151' : '#e2e8f0',
    zIndex: 1000,
  }}>
    {/* Upward Arrow — now centered on button */}
    <View style={{
      position: 'absolute',
      top: -10,
      left: 80,                       // ← Centers arrow under the button
                                      //     (half of dropdown width: 180/2 = 90 → adjust to 80 for visual balance)
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderBottomWidth: 12,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: darkMode ? '#1f2937' : '#ffffff',
    }} />

    {/* Arrow shadow for depth */}
    <View style={{
      position: 'absolute',
      top: -11,
      left: 79,
      width: 0,
      height: 0,
      borderLeftWidth: 11,
      borderRightWidth: 11,
      borderBottomWidth: 13,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: 'rgba(0,0,0,0.15)',
      zIndex: -1,
    }} />

    {/* Content (same as before, just slightly tighter) */}
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Ionicons name="unlink-outline" size={18} color="#dc2626" style={{ marginRight: 8 }} />
      <Text style={{ fontSize: 15, fontWeight: '700', color: darkMode ? '#fca5a5' : '#dc2626' }}>
        Disconnect Stripe?
      </Text>
    </View>

    <Text style={{ 
      fontSize: 13, 
      color: darkMode ? '#9ca3af' : '#6b7280', 
      marginBottom: 14,
      lineHeight: 18 
    }}>
      Payment links will no longer be attached to new invoices.
    </Text>

    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 14 }}>
      <TouchableOpacity onPress={() => setShowDisconnectMenu(false)}>
        <Text style={{ fontWeight: '600', fontSize: 14, color: '#10b981' }}>
          Cancel
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={async () => {
          await AsyncStorage.removeItem('connectedStripeAccountId');
          setIsStripeConnected(false);
          setShowDisconnectMenu(false);
          showMsg('Disconnected from Stripe');
        }}
      >
        <Text style={{ fontWeight: '700', fontSize: 14, color: '#dc2626' }}>
          Disconnect
        </Text>
      </TouchableOpacity>
    </View>
  </View>
)}

  {/* Backdrop - tap outside to close */}
  {showDisconnectMenu && (
    <TouchableOpacity
      style={{
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
      }}
      activeOpacity={1}
      onPress={() => setShowDisconnectMenu(false)}
    />
  )}

</View>

 
 <GestureTouchableOpacity onPress={() => {
      setSelectedHistoryIds({});
      setShowHistory(true);
    }}>
      <Icon name="history" size={28} color="#10b981" />
    </GestureTouchableOpacity>

    <GestureTouchableOpacity onPress={() => setShowTemplates(true)}>
      <Icon name="folder-open" size={28} color="#10b981" />
    </GestureTouchableOpacity>

    <GestureTouchableOpacity onPress={() => setShowDatabase(true)}>
      <Icon name="storage" size={28} color="#6366f1" />
    </GestureTouchableOpacity>

    <GestureTouchableOpacity
  onPress={toggleDarkMode}
  activeOpacity={0.6}  // Gives immediate visual feedback
>
  <Icon
    name={darkMode ? 'brightness-7' : 'brightness-2'}
    size={28}
    color={darkMode ? '#fbbf24' : '#60a5fa'}
  />
</GestureTouchableOpacity>
  </View>
</View>
   
   
   
   
   
   
   <ScrollView ref={scrollRef}
  contentContainerStyle={{ 
    paddingTop: 75,        // THIS LINE MAKES IT WORK
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1 
  }}
  showsVerticalScrollIndicator={false}
>


          {/* CUSTOMER INFO */}
          
          <View style={{ position: 'relative', marginBottom: 32 }}>
  <StepBadge number="①" />

  {/* Your existing customer card/content */}
  <View style={styles.card}>
    {/* Customer inputs, etc. */}
  </View>
</View>
   {/* Customer Selector Button */}
  
<TouchableOpacity
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: darkMode ? '#1f2937' : '#f0fdf4',
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    borderWidth: 2,
    borderColor: '#10b981',
  }}
  onPress={() => setShowCustomerMenu(true)}
>
  <Ionicons name="person-outline" size={28} color="#10b981" />
  <View style={{ marginLeft: 16, flex: 1 }}>
    <Text style={{ fontSize: 18, fontWeight: '800', color: '#10b981' }}>
      {customer.name || 'Select Customer'}
    </Text>
    {(customer.phone || customer.email) && (
      <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
        {customer.phone} {customer.email && `• ${customer.email}`}
      </Text>
    )}
  </View>
  <Ionicons name="chevron-down" size={24} color="#10b981" />
</TouchableOpacity>


   

{/* ============================================= */}
{/* JOBS SECTION — WITH FULL HELP OVERLAYS       */}
{/* ============================================= */}



<View style={{ position: 'relative', marginBottom: 32 }}>
  <StepBadge number="②" />

  {/* Your jobs cards or list */}
</View>
<View style={styles.section}>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
    <Text style={[styles.title, darkMode && styles.textDark]}>
      <Icon name="build" size={24} color="#10b981" /> Jobs
    </Text>

    {/* MANAGE JOBS BUTTON + HELP */}
    <View 
  ref={manageJobsBtnRef}
  onLayout={() => {
    // This is the only method that 100% works in ScrollView on both platforms
    manageJobsBtnRef.current?.measureInWindow((x, y, width, height) => {
      setHelpPositions(prev => ({
        ...prev,
        manageJobsBtn: { y, height, width }
      }));
    });
  }}
>
 <TouchableOpacity

  style={[styles.addBtn, darkMode && styles.addBtnDark]}
  onPress={() => {setShowJobManager(true);
  setSelectedForDelete({});}}
>
    <Icon name="settings" size={22} color="#10b981" />
    <Text style={styles.addText}>Manage Jobs</Text>
  </TouchableOpacity>
  </View>
  </View>

  {/* SELECTED JOBS — BIG TILES + HELP */}
    {/* SELECTED JOBS — BIG TILES + CLEAN BOTTOM TOAST (FINAL WORKING) */}
  {selectedJobs.length === 0 ? (
    <View style={{ padding: 30, alignItems: 'center' }}>
      <Text style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: 18, fontStyle: 'italic' }}>
        No jobs selected
      </Text>
    </View>
  ) : (
    <>
    {/* HORIZONTAL JOB TILES — CLOUDS PASSING BY EFFECT */}
{/* ==================== GHOST JOBS – INVISIBLE & SCROLLS PERFECTLY ==================== */}
{selectedJobs.length > 0 && (
  <View style={{ marginVertical: 20 }}>
    <Text style={[styles.title, darkMode && styles.textDark, { marginLeft: 20, marginBottom: 10 }]}>
      Selected Jobs ({selectedJobs.length})
    </Text>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 28, // nice breathing room
        // ← REMOVED alignItems: 'center' → this was the bug!
      }}
    >
      {selectedJobs.map((job) => {
        const itemCount = itemsByJob[job]?.length || 0;
        const isSelected = !!selectedForDelete[job];

        return (
          <TouchableOpacity
            key={job}
            activeOpacity={0.7}
            hitSlop={{ top: 20, bottom: 20, left: 30, right: 30 }}
            onPress={() => {
              if (Object.keys(selectedForDelete).length > 0) {
                setSelectedForDelete(prev => {
                  const n = { ...prev };
                  if (n[job]) delete n[job];
                  else n[job] = true;
                  return Object.keys(n).length === 0 ? {} : n;
                });
              } else {
                setCurrentJob(job);
              }
            }}
            onLongPress={() => setSelectedForDelete(prev => ({ ...prev, [job]: true }))}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8, // tiny invisible padding so taps feel natural
            }}
          >
            {/* Optional tiny red dot when selected for delete */}
            {isSelected && (
              <View style={{
                position: 'absolute',
                top: -14,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: '#dc2626',
              }} />
            )}

            <Text style={{
              fontSize: 19,
              fontWeight: '600',
              color: darkMode ? '#e2e8f0' : '#1e293b',
            }}>
              {job}
            </Text>

            <Text style={{
              fontSize: 14,
              marginTop: 4,
              color: darkMode ? '#94a3b8' : '#64748b',
              fontWeight: '500',
            }}>
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
)}

            {/* SMALLER, CLEANER SKULL TOAST */}
      {Object.keys(selectedForDelete).length > 0 && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            bottom: 100,
            left: 20,
            right: 20,
            zIndex: 9999,
          }}
        >
          <View style={{
            backgroundColor: '#dc2626',
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 20,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="skull-outline" size={22} color="white" />
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>
                {Object.keys(selectedForDelete).length} selected
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                 setSelectedJobs(p => p.filter(j => !selectedForDelete[j]));
                    setItemsByJob(p => {
                      const c = { ...p };
                      Object.keys(selectedForDelete).forEach(j => delete c[j]);
                      return c;
                    });
                    setSelectedForDelete({});
                    showMsg('Jobs removed from estimate');
              }}
              style={{
                backgroundColor: 'white',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 15 }}>
                Remove
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  )}
</View>

{/* JOB MANAGER MODAL — FINAL, FLAWLESS VERSION */}

<Modal transparent animationType="slide" visible={showJobManager} onRequestClose={() => setShowJobManager(false)}>
  <View pointerEvents="box-none" style={styles.modalOverlay}>
    <View style={{
      width: '98%',
      height: '90%',
      backgroundColor: darkMode ? '#111' : '#fff',
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 24,
    }}>
      
      {/* HEADER */}
      <View style={{
        padding: 20,
        paddingBottom: 12,
        backgroundColor: darkMode ? '#1f2937' : '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: darkMode ? '#374151' : '#e2e8f0',
      }}>
        <View style={styles.jobManagerHeader}>
          <Text style={styles.jobManagerTitle}>Job Types</Text>
          <TouchableOpacity
            onPress={() => {
              setShowJobManager(false);
              setSelectedForDelete({});
            }}
          >
            <Icon name="close" size={32} color={darkMode ? "#e5e7eb" : "#374151"} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.jobManagerAdd}
          onPress={() => setShowAddJob(true)}
        >
          <Icon name="add-circle" size={28} color="#10b981" />
          <Text style={styles.jobManagerAddText}>Build New Job</Text>
        </TouchableOpacity>
      </View>

      {/* MAIN CONTENT */}
      {Object.keys(JOB_TYPES).length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: 18, textAlign: 'center' }}>
            No job types yet.{'\n'}Tap "Build New Job" to create one.
          </Text>
        </View>
      ) : (
        <FlatList
          data={Object.keys(JOB_TYPES)}
          keyExtractor={item => item}
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          renderItem={({ item: job }) => {
  const itemCount = JOB_TYPES[job].length;
  const isInEstimate = selectedJobs.includes(job);
  const isSelected = !!selectedForDelete[job];

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: isSelected
        ? (darkMode ? '#374151' : '#fee2e2')
        : 'transparent',
      borderRadius: 16,
      marginHorizontal: 8,
      marginVertical: 2,
    }}>
      {/* TAP JOB NAME TO ADD/REMOVE FROM ESTIMATE */}
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={() => {
          if (Object.keys(selectedForDelete).length > 0) {
            // Multi-select mode — select for delete
            setSelectedForDelete(prev => {
              const copy = { ...prev };
              copy[job] ? delete copy[job] : copy[job] = true;
              return Object.keys(copy).length === 0 ? {} : copy;
            });
          } else {
            // Normal mode — add/remove from estimate
            toggleJobFromManager(job);
          }
        }}
        onLongPress={() => setSelectedForDelete(prev => ({ ...prev, [job]: true }))}
      >
        <Text style={{
          fontSize: 15.5,
          fontWeight: '700',
          color: isSelected ? '#dc2626' : (darkMode ? '#f1f5f9' : '#1f2937'),
        }}>
          {job}
        </Text>
        <Text style={{ fontSize: 11.5, color: '#94a3b8' }}>
          {itemCount} item{itemCount !== 1 ? 's' : ''}{isInEstimate && ' • In use'}
        </Text>
      </TouchableOpacity>

    {/* RIGHT SIDE — EDIT ICON OR SKULL WHEN SELECTED */}
<View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
  <TouchableOpacity
    onPress={() => {
      if (isSelected) {
        // If selected for delete, do nothing on tap (or deselect if you want)
        return;
      }
      openJobItemsFromManager(job);
    }}
    style={{
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#fefce8',
      borderWidth: 2.5,
      borderColor: '#fcd34d',
      justifyContent: 'center',
      alignItems: 'center',
    }}
    disabled={isSelected}  // Optional: disable edit when selected for delete
  >
    {isSelected ? (
      <Ionicons name="skull-outline" size={26} color="#dc2626" />
    ) : (
      <Icon name="edit" size={18} color="#92400e" />
    )}
  </TouchableOpacity>
</View>
    </View>
  );
}}
        />
      )}

      {/* RED DELETE TOAST */}
      {Object.keys(selectedForDelete).length > 0 && (
        <View style={{
          position: 'absolute',
          bottom: 90,
          left: 16,
          right: 16,
          backgroundColor: '#dc2626',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="skull-outline" size={24} color="white" />
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 17 }}>
              {Object.keys(selectedForDelete).length} selected
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              const count = Object.keys(selectedForDelete).length;
              showConfirm({
                title: 'Delete Jobs?',
                message: `Permanently delete ${count} job type${count > 1 ? 's' : ''}?`,
                confirmText: 'Delete',
                destructive: true,
                onConfirm: () => {
                  const newTypes = { ...JOB_TYPES };
                  Object.keys(selectedForDelete).forEach(j => delete newTypes[j]);
                  saveJobTypes(newTypes);
                  setSelectedForDelete({});
                  showMsg(`${count} deleted`);
                },
              });
            }}
            style={{ backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}
          >
            <Text style={{ color: '#dc2626', fontWeight: '800' }}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  </View>
</Modal>




<Modal visible={showDeleteDocConfirm} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
      <Text style={[styles.modalTitle, darkMode && styles.textDark]}>
        Delete Document?
      </Text>
      <Text style={{ color: darkMode ? '#e5e7eb' : '#1f2937', textAlign: 'center', marginBottom: 20 }}>
        This cannot be undone.
      </Text>
      <View style={styles.modalActions}>
        <TouchableOpacity 
          style={styles.modalCancel} 
          onPress={() => {
            setShowDeleteDocConfirm(false);
            setDocToDelete(null);
          }}
        >
          <Text style={styles.modalBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.modalDelete} 
          onPress={() => deleteDocument(docToDelete)}
        >
          <Text style={styles.modalBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>


    {/* ADDITIONAL COSTS — NO GAP */}
<View style={{ position: 'relative', marginBottom: 32 }}>
  <StepBadge number="③" />
</View>

{/* Title and Totals — Tight together */}
<View style={{ marginTop: 8 }}>
  <Text style={[styles.title, darkMode && styles.textDark]}>
    <Icon name="percent" size={20} color="#10b981" /> Additional Costs
  </Text>

  {/* TOTALS — TAPPABLE ROWS */}
  <View style={[styles.totals, darkMode && styles.totalsDark]}>
    {/* MARKUP ROW — TAPPABLE WITH CHEVRON */}
   <TouchableOpacity
  activeOpacity={0.8}
  onPress={() => {
    setTempMarkup(markupPercent);
    setShowMarkup(true);
  }}
   style={[
    styles.totalRow,
    { opacity: parseFloat(markupPercent) > 0 ? 1 : 0.6 }  // Slightly faded when 0%
  ]}
>
  {/* Chevron on the LEFT */}
  <Ionicons
    name="chevron-forward"
    size={18}
    color="#86efac"
    style={{ position: 'absolute', left: 16, top: '50%', marginTop: -9 }}  // vertically centered
  />

  <Text style={[styles.totalLabel, darkMode && styles.totalLabelDark, { paddingLeft: 40 }]}>
    Materials (after {markupPercent}% markup):
  </Text>

  <Text style={[styles.totalValue, darkMode && styles.totalValueDark]}>
    {getCurrencySymbol()}{formatPrice(markupTotal)}
  </Text>
</TouchableOpacity>

  {/* TAX ROW — ALWAYS VISIBLE, TAPPABLE EVEN AT 0% */}
<TouchableOpacity
  activeOpacity={0.8}
  onPress={() => {
    setTempTax(taxPercent || '0');
    setShowTax(true);
  }}
  style={[
    styles.totalRow,
    { opacity: parseFloat(taxPercent) > 0 ? 1 : 0.6 }  // Slightly faded when 0%
  ]}
>
  {/* Chevron on the LEFT */}
  <Ionicons
    name="chevron-forward"
    size={18}
    color="#86efac"
    style={{ position: 'absolute', left: 16, top: '50%', marginTop: -9 }}
  />

  <Text style={[
    styles.totalLabel,
    darkMode && styles.totalLabelDark,
    { paddingLeft: 40 }
  ]}>
    Tax ({taxPercent || 0}%):
  </Text>

  <Text style={[
    styles.totalValue,
    darkMode && styles.totalValueDark
  ]}>
    {getCurrencySymbol()}{formatPrice(taxAmount)}
  </Text>
</TouchableOpacity>

   {/* LABOR ROW — TAPPABLE WITH CHEVRON ON LEFT */}
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => {
        setTempSH(standardHours);
        setTempOH(otHours);
        setTempTH(travelHours);
        setTempSR(standardRate);
        setTempOR(otRate);
        setTempTR(travelRate);
        setShowLabor(true);
      }}
      style={[
    styles.totalRow,
    { opacity: parseFloat(laborTotal) > 0 ? 1 : 0.6 }  // Slightly faded when 0%
  ]}
    >
      {/* Chevron on the LEFT */}
      <Ionicons
        name="chevron-forward"
        size={18}
        color="#86efac"
        style={{ position: 'absolute', left: 16, top: '50%', marginTop: -9 }}
      />

      <Text style={[styles.totalLabel, darkMode && styles.totalLabelDark, { paddingLeft: 40 }]}>
        Labor:
      </Text>
      <Text style={[styles.totalValue, darkMode && styles.totalValueDark]}>
        {getCurrencySymbol()}{formatPrice(laborTotal)}
      </Text>
    </TouchableOpacity>

    {/* GRAND TOTAL — NO CHEVRON */}
    <View style={[
      styles.totalRow,
      {
        borderTopWidth: 2,
        borderTopColor: darkMode ? '#374151' : '#e2e8f0',
        paddingTop: 12,
        marginTop: 12,
      }
    ]}>
      <Text style={[styles.grand, darkMode && styles.grandDark]}>GRAND TOTAL</Text>
      <Text style={[styles.grand, darkMode && styles.grandDark]}>
        {getCurrencySymbol()}{formatPrice(grandTotal)}
      </Text>
    </View>
  </View>
</View>
    
    
{/* NOTES SECTION */}

 <View style={{ position: 'relative', marginBottom: 32 }}>
  <StepBadge number="④" />
</View>
<View style={styles.section}>
  <Text style={[styles.title, darkMode && styles.textDark]}>
    <Icon name="note" size={20} color="#10b981" /> Notes
  </Text>
  <TextInput
    style={[styles.input, styles.notesInput, darkMode && styles.inputDark]}
    placeholder="Add any scope details, exclusions, validity period, payment terms, etc..."
    placeholderTextColor={darkMode ? '#9ca3af' : '#6b7280'}
    value={notes}
    onChangeText={setNotes}
    multiline
    numberOfLines={6}
    textAlignVertical="top"
  />
</View>


{/* JOBSITE PHOTOS */}
{/* JOBSITE PHOTOS – NOW WITH CAMERA + GALLERY */}
 <View style={{ position: 'relative', marginBottom: 32 }}>
  <StepBadge number="⑤" />
</View>
<View style={styles.section}>
  <Text style={[styles.title, darkMode && styles.textDark]}>
    <Icon name="camera-alt" size={20} color="#10b981" /> Jobsite Photos ({jobsitePhotos.length})
  </Text>

  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
    {/* TAKE PHOTO */}
    <TouchableOpacity
      style={[styles.btn, styles.btnFlex, darkMode && styles.btnDark]}
      onPress={async () => {
  if (!isPro && jobsitePhotos.length >= 3) {
    setShowPaywall(true);
    showQuickToast('Unlimited jobsite photos are a Pro feature');
    return;
  }

  addJobsitePhoto();
}}
    >
      <Icon name="camera-alt" size={20} color="#10b981" />
      <Text style={styles.btnText}>Take Photo</Text>
    </TouchableOpacity>

    {/* PICK FROM GALLERY */}
    <TouchableOpacity
      style={[styles.btn, styles.btnFlex, darkMode && styles.btnDark]}
      onPress={async () => {
  if (!isPro && jobsitePhotos.length >= 3) {
    setShowPaywall(true);
    showQuickToast('Unlimited jobsite photos are a Pro feature');
    return;
  }

  pickJobsitePhotosFromGallery();
}}
    >
      <Icon name="photo-library" size={20} color="#10b981" />
      <Text style={styles.btnText}>Add from Gallery</Text>
    </TouchableOpacity>
  </View>

  {jobsitePhotos.length > 0 && (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
      {jobsitePhotos.map((photo, index) => (
        <View key={index} style={{ marginRight: 12, position: 'relative' }}>
         <Image
  source={{ uri: photo }}   // ← photo is already a string, so this works perfectly
  style={{ width: 100, height: 100, margin: 4, borderRadius: 8 }}
  resizeMode="cover"
/>
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 20,
              padding: 6,
            }}
            onPress={() => removeJobsitePhoto(index)}
          >
            <Icon name="close" size={20} color="white" />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  )}
</View>



{/* ——————————————————— FINAL BOTTOM BAR — PERFECT SPACING + SUBTLE ANIMATIONS ——————————————————— */}
<View style={{
  paddingHorizontal: 20,
  borderRadius: 20,
  paddingTop: 20,
  paddingBottom: 5, // safe for notch
  backgroundColor: darkMode ? '#0f172a' : '#ffffff',
  borderTopWidth: 1,
  borderTopColor: darkMode ? '#1e293b' : '#e2e8f0',
  alignItems: 'center',
}}>
<View style={{ position: 'relative', marginBottom: 32 }}>
  <StepBadge number="⑥" />
</View>

  


  <View style={{
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  }}>

    {/* 1. INVOICE MODE */}
    <Animated.View style={{ transform: [{ scale: invoiceScale }],
    borderRadius: 22,
    borderWidth: 2,
    borderColor: darkMode ? '#334155' : '#cbd5e1',
    backgroundColor: isInvoiceMode ? '#fefce8' : (darkMode ? '#1e293b' : '#f1f5f9'),
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => pressAnim(invoiceScale)}
        onPress={() => {
  const newMode = !isInvoiceMode;
  setIsInvoiceMode(newMode);

  // THIS IS THE ONLY NEW LINE — beautiful toast!
  Toast.show({
    type: 'invoice_mode',
    text1: newMode ? 'Invoice Mode ' : 'Estimate Mode',
    text2: newMode ? 'ON' : 'OFF',
    visibilityTime: 2400,
    onShow: () => {
      toastAnim.setValue(0.93);
      Animated.spring(toastAnim, {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }).start();
    },
  });
}}
      >
        <Icon name="receipt-long" size={25} color={isInvoiceMode ? '#92400e' : (darkMode ? '#94a3b8' : '#4b5563')} />
        
      </TouchableOpacity>
    </Animated.View>

<Animated.View style={{ transform: [{ scale: generateScale }] }}>
  <TouchableOpacity
    activeOpacity={1}
    onPressIn={() => pressAnim(generateScale)}
    onPress={async () => {
  // === CUSTOMER NAME REQUIRED CHECK ===
  if (!customer.name?.trim()) {
    showQuickToast('⚠️ Add Client First');
    setShowCustomerMenu(true);
    return;
  }

  // === AT LEAST ONE JOB REQUIRED CHECK ===
  if (selectedJobs.length === 0) {
    showQuickToast('⚠️ Add Job First');
    setShowJobManager(true);
    return;
  }


      setIsGeneratingPayment(true);
      try {
        const result = await generateDocumentPdf({
          isInvoice: isInvoiceMode,
          invoiceNumber,
          customer: { ...customer },
          companyName,
          companyAddress,
          companyPhone,
          contractorEmail,
          logoUri,
          jobs: [...selectedJobs],
          itemsByJob: JSON.parse(JSON.stringify(itemsByJob)),
          notes,
          jobsitePhotos: [...jobsitePhotos],
          labor: {
            standardHours: parseFloat(standardHours) || 0,
            otHours: parseFloat(otHours) || 0,
            travelHours: parseFloat(travelHours) || 0,
          },
          rates: {
            standardRate: parseFloat(standardRate) || 0,
            otRate: parseFloat(otRate) || 0,
            travelRate: parseFloat(travelRate) || 0,
          },
          markupPercent: parseFloat(markupPercent) || 0,
          taxPercent: parseFloat(taxPercent || 0),
        });
        // === DETERMINE CURRENT NUMBER & INCREMENT FOR NEXT ===
        let currentNumber;
        let nextNumberKey;

        if (isInvoiceMode) {
          // Invoices use shared invoiceNumber state + lastInvoiceNumber
          currentNumber = invoiceNumber;
          const next = String(parseInt(invoiceNumber) + 1);
          await AsyncStorage.setItem('lastInvoiceNumber', invoiceNumber);
          setInvoiceNumber(next);
        } else {
          // Estimates use separate counter
          const last = await AsyncStorage.getItem('lastEstimateNumber');
          const nextEst = last ? parseInt(last) + 1 : 2001;
          currentNumber = String(nextEst);
          await AsyncStorage.setItem('lastEstimateNumber', currentNumber);
        }

        // === CREATE DOCUMENT OBJECT ===
        const fullDocument = {
          id: Date.now().toString(),
          type: isInvoiceMode ? 'invoice' : 'estimate',
          invoiceNumber: currentNumber,
          createdDate: new Date().toISOString(),
          dueDate: dueDate || null,
          status: isInvoiceMode ? 'unpaid' : null,
          pdfUri: result.pdfUri,
          amount: result.grandTotal,
          customer: { ...customer },
          customerName: customer.name?.trim() || 'Customer',
          jobs: [...selectedJobs],
          itemsByJob: JSON.parse(JSON.stringify(itemsByJob)),
          labor: { standardHours, otHours, travelHours },
          rates: { standardRate, otRate, travelRate },
          markupPercent: parseFloat(markupPercent) || 0,
          taxPercent: parseFloat(taxPercent || 0),
          notes: notes || '',
          jobsitePhotos: [...jobsitePhotos],
          paymentUrl: result.paymentUrl || null,
          paymentStatus: result.paymentUrl ? 'pending' : null,
        };

        // Update state — newest first
        const updatedDocs = [fullDocument, ...allDocuments];
        setAllDocuments(updatedDocs);

        // === TRY BACKEND ===
        try {
          await fetch('https://hartman-estimate.vercel.app/api/save-documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedDocs),
          });
        } catch (err) {
          console.warn('Backend save failed — saved locally only', err);
        }

        // === ALWAYS SAVE LOCALLY ===
        try {
          await AsyncStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
        } catch (err) {
          console.error('Local save failed!', err);
          showMsg('Saved to list but sync failed');
        }

        // === SUCCESS TOAST ===
        Toast.show({
          type: 'pdf_saved',
          text1: isInvoiceMode
            ? `Invoice #${currentNumber} saved!${result.paymentUrl ? ' • Payment link attached' : ''}`
            : `Estimate #E-${currentNumber} saved!`,
          visibilityTime: 3000,
        });

        setCurrentDocForActions(fullDocument);
        setTimeout(() => setShowDocumentActionSheet(true), 400);
    
      } catch (err) {
        console.error('PDF CREATE ERROR:', err);
        showMsg('Create failed — check console');
      } finally {
        setIsGeneratingPayment(false);
      }
    }}
    style={{
      width: 64,
      height: 64,
      backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: darkMode ? '#334155' : '#cbd5e1',
    }}
  >
    {/* SPINNING LOADER WHEN GENERATING */}
    <Animated.View
      style={{
        transform: [
          {
            rotate: isGeneratingPayment
              ? generateSpin.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                })
              : '0deg',
          },
        ],
      }}
    >
      <Icon
        name={isGeneratingPayment ? "autorenew" : "picture-as-pdf"}
        size={28}
        color={
          isGeneratingPayment
            ? '#10b981'
            : isInvoiceMode
            ? '#92400e'
            : darkMode
            ? '#94a3b8'
            : '#4b5563'
        }
      />
    </Animated.View>
  </TouchableOpacity>
</Animated.View>

    {/* 3. SAVE */}
<Animated.View style={{ transform: [{ scale: saveScale }] }}>
  <TouchableOpacity
    activeOpacity={1}
    onPressIn={() => pressAnim(saveScale)}
    onPress={() => {
      // === SMART AUTO-FILL LOGIC FOR DRAFT NAME ===
      let baseName = customer.name.trim();

      if (!baseName) {
        // No customer name → use appropriate prefix + number
        if (isInvoiceMode) {
          baseName = `Invoice #${invoiceNumber}`;
        } else {
          baseName = `Estimate #E-${invoiceNumber}`;
        }
      } else if (isInvoiceMode) {
        // Customer name exists + Invoice mode → include invoice number for clarity
        baseName = `Invoice #${invoiceNumber} - ${baseName}`;
      }
      // For estimates with customer name: just use the name (clean and simple)

      // === MAKE NAME UNIQUE (avoid overwriting existing drafts) ===
      let finalName = baseName;
      let counter = 1;
      while (TEMPLATES[finalName]) {
        finalName = `${baseName} (${counter})`;
        counter++;
      }

      // === APPLY NAME AND OPEN MODAL ===
      setTemplateName(finalName);
      setShowSaveTemplate(true);
    }}
    style={{
      width: 64,
      height: 64,
      backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: darkMode ? '#334155' : '#cbd5e1',
    }}
  >
    <Icon name="save" size={28} color={darkMode ? '#94a3b8' : '#475569'} />
  </TouchableOpacity>
</Animated.View>

    {/* 4. CLEAR */}
    <Animated.View style={{ transform: [{ scale: clearScale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => pressAnim(clearScale)}
        onPress={clearEstimate}
        style={{
          width: 64,
          height: 64,
          backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
          borderRadius: 22,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: darkMode ? '#334155' : '#cbd5e1',
        }}
      >
      
       
        <Ionicons name="skull-outline" size={28} color={darkMode ? '#94a3b8' : '#475569'} />
      </TouchableOpacity>
    </Animated.View>

  </View>
</View>

{/* Tiny PRO Pill Indicator  */}
  {isPro && (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: darkMode ? '#1e293b' : '#f0fdfa',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#86efac',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 8,
      }}
      onPress={async () => {
        try {
          showQuickToast('Restoring purchases...');

          if (Platform.OS === 'android') {
            await Purchases.syncPurchases();
          } else {
            await Purchases.restorePurchases();
          }

          const customerInfo = await Purchases.getCustomerInfo();
          if (customerInfo.entitlements.active['pro']) {
            setIsPro(true);
            showQuickToast('Pro restored! 🎉');
          } else {
            showQuickToast('No active Pro found');
          }
        } catch (error) {
          console.error('Restore failed:', error);
          showQuickToast('Restore failed');
        }
      }}
    >
      <Text style={{
        fontSize: 11,
        fontWeight: '800',
        color: '#86efac',
        letterSpacing: 0.5,
      }}>
        PRO
      </Text>
      <Ionicons
        name="refresh-outline"
        size={14}
        color="#86efac"
        style={{ marginLeft: 4 }}
      />
    </TouchableOpacity>
  )}


  
   {/* SEND FEEDBACK BUTTON — ICON SAME SIZE AS TEXT, ALIGNED RIGHT */}
<View style={{
  alignItems: 'center', 
  marginVertical: 60,
  
}}>
  

 <TouchableOpacity
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkMode ? '#1e293b' : '#f0fdfa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#86efac',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 8,
    gap: 8, // space between text and icon
  }}
  onPress={() => {
    Linking.openURL('https://barebones-dev.vercel.app/#contact');
  }}
>
  <Text style={{
    fontSize: 13,
    fontWeight: '700',
    color: darkMode ? '#cbd5e1' : '#1e293b',
  }}>
    app feedback
  </Text>

  <Ionicons
    name="paper-plane-outline"
    size={16}
    color="#86efac"
  />
</TouchableOpacity>
</View>
        </ScrollView>
      </KeyboardAvoidingView>



{/* ITEM DATABASE PICKER MODAL - FIXED: NO DUPLICATES + VISUAL FEEDBACK */}
<Modal transparent animationType="slide" visible={showItemDatabasePicker} onRequestClose={() => setShowItemDatabasePicker(false)}>
  <View pointerEvents="box-none" style={styles.modalOverlay}>
    <View style={[styles.modalBox, darkMode && styles.modalBoxDark, { maxHeight: '90%' }]}>
      <Text style={[styles.modalTitle, darkMode && styles.textDark]}>
        Add Items from Database
      </Text>

      {/* Search */}
      <TextInput
        style={[styles.modalInput, darkMode && styles.inputDark]}
        placeholder="Search items..."
        value={globalItemSearch}
        onChangeText={setGlobalItemSearch}
        autoFocus
      />
      
      

      
     




      {/* Item List */}
      <ScrollView style={{ maxHeight: 400 }}>
        {filteredGlobalItems.length === 0 ? (
          <Text style={{ padding: 20, textAlign: 'center', color: darkMode ? '#94a3b8' : '#64748b' }}>
            No items found
          </Text>
        ) : (
          filteredGlobalItems.map((item, idx) => {
            const key = `dbitem-${idx}`;
            const isSelected = !!selectedDatabaseItems[key];
            const alreadyInJob = currentJob && 
              (itemsByJob[currentJob] || []).some(i => i.name === item.name);

            const isDisabled = alreadyInJob;

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dropdownItem,
                  isSelected && styles.dropdownItemSelected,
                  isDisabled && { opacity: 0.5, backgroundColor: darkMode ? '#374151' : '#fee2e2' },
                  darkMode && { borderBottomColor: '#444' },
                ]}
                onPress={() => {
                  if (isDisabled) {
                    showMsg(`${item.name} already added`);
                    return;
                  }

                  setSelectedDatabaseItems(prev => ({
                    ...prev,
                    [key]: !prev[key]
                  }));
                }}
                disabled={isDisabled}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    color: darkMode ? '#e5e7eb' : '#1f2937', 
                    fontWeight: '600',
                    textDecorationLine: isDisabled ? 'line-through' : 'none'
                  }}>
                    {item.name}
                  </Text>
                  <Text style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: 13 }}>
  ${(item.price ?? 0).toFixed(2)} each
  {isDisabled && ' (already added)'}
</Text>
                </View>
                {isSelected && !isDisabled && <Icon name="check-circle" size={24} color="#10b981" />}
                {isDisabled && <Icon name="block" size={24} color="#dc2626" />}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Footer */}
      <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: darkMode ? '#374151' : '#e2e8f0' }}>
        <Text style={{ textAlign: 'center', marginBottom: 12, fontWeight: '600', color: darkMode ? '#e5e7eb' : '#1f2937' }}>
          {Object.keys(selectedDatabaseItems).filter(k => selectedDatabaseItems[k]).length} selected
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            style={[styles.modalCancel, { flex: 1 }]}
            onPress={() => {
              setShowItemDatabasePicker(false);
              setSelectedDatabaseItems({});
              setGlobalItemSearch('');
            }}
          >
            <Text style={styles.modalBtnText}>Cancel</Text>
          </TouchableOpacity>
         <TouchableOpacity
  style={[styles.saveBtn, { backgroundColor: '#8b5cf6' }]}
  onPress={async () => {
    const itemsToAdd = Object.keys(selectedDatabaseItems)
      .map(key => {
        const index = parseInt(key.split('-')[1]);
        return filteredGlobalItems[index];
      })
      .filter(Boolean);

    if (itemsToAdd.length === 0) {
      showMsg('No items selected');
      return;
    }

    // 1. Add to current estimate
    setItemsByJob(prev => ({
      ...prev,
      [currentJob]: [
        ...(prev[currentJob] || []),
        ...itemsToAdd.map(item => ({ ...item, qty: 1 }))
      ]
    }));

    // 2. Add to JOB DEFAULTS (this was missing!)
    const currentDefaults = JOB_TYPES[currentJob] || [];
    const newDefaults = [...currentDefaults];

    itemsToAdd.forEach(item => {
      // Avoid duplicates in defaults
      if (!currentDefaults.some(d => d.name.toLowerCase() === item.name.toLowerCase())) {
        newDefaults.push({ name: item.name, price: item.price });
      }
    });

    // Save updated defaults
    const updatedJobTypes = { ...JOB_TYPES, [currentJob]: newDefaults };
    await saveJobTypes(updatedJobTypes);

    // Cleanup
    setSelectedDatabaseItems({});
    setShowItemDatabasePicker(false);
    setGlobalItemSearch('');

    showMsg(`${itemsToAdd.length} item${itemsToAdd.length > 1 ? 's' : ''} added to ${currentJob} defaults`);
  }}
>
  <Text style={styles.modalBtnText}>Add Selected</Text>
</TouchableOpacity>
        </View>
      </View>
    </View>
  </View>
</Modal>

     {/* ADD DEFAULT ITEM TO JOB TYPE */}
     
     

  {/* ADD DEFAULT ITEM MODAL — NOW SAFE + SYNCED */}
{showAddDefaultItem && (
  <Modal visible={showAddDefaultItem} transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
        <Icon name="add-circle" size={26} color="white" />
        <Text color style={[styles.modalTitle, darkMode && styles.textDark]}>
          Add Item {currentJob}
        </Text>

        <TextInput
          style={[styles.modalInput, darkMode && styles.inputDark]}
          placeholder="Item name"
          placeholderTextColor={darkMode ? "#94a3b8" : "#9ca3af"}
          value={newItemName}
          onChangeText={setNewItemName}
        />
        <TextInput
          style={[styles.modalInput, darkMode && styles.inputDark]}
          placeholder="Price"
          placeholderTextColor={darkMode ? "#94a3b8" : "#9ca3af"}
          value={newItemPrice}
          onChangeText={setNewItemPrice}
          keyboardType="decimal-pad"
        />

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          <TouchableOpacity
            style={styles.modalCancel}
            onPress={() => {
              setShowAddDefaultItem(false);
              setNewItemName('');
              setNewItemPrice('');
            }}
          >
            <Text style={styles.modalBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modalOK}
            onPress={async () => {
              const success = await addDefaultItemToJob(currentJob, newItemName, newItemPrice);
              if (success) {
                setShowAddDefaultItem(false);
                setNewItemName('');
                setNewItemPrice('');
              }
            }}
          >
            <Text style={styles.modalBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
)}

<Modal visible={isSavingFile} transparent>
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ backgroundColor: darkMode ? '#1f2937' : 'white', padding: 32, borderRadius: 20, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: darkMode ? 'white' : '#1f2937', marginBottom: 16 }}>
        Saving file…
      </Text>
      <ActivityIndicator size="large" color="#10b981" />
    </View>
  </View>
</Modal>

      {/* EDIT GLOBAL ITEM */}
      <Modal visible={showEditGlobalItem} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Edit Global Item</Text>
            <TextInput style={[styles.modalInput, darkMode && styles.inputDark]} value={editGlobalName} onChangeText={setEditGlobalName} />
            <TextInput style={[styles.modalInput, darkMode && styles.inputDark]} value={editGlobalPrice} onChangeText={setEditGlobalPrice} keyboardType="numeric" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditGlobalItem(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOK} onPress={() => {
                const price = parseFloat(editGlobalPrice);
                if (!editGlobalName || isNaN(price)) {
                  Alert.alert('Invalid', 'Fill name & price');
                  return;
                }
                const updated = [...GLOBAL_ITEMS];
                updated[editGlobalItemIdx] = { name: editGlobalName, price };
                saveGlobalItems(updated);
                setShowEditGlobalItem(false);
                showMsg('Global item updated');
              }}>
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


{/* COMPANY LOGO PICKER - CLEAN & PROFESSIONAL */}
<Modal visible={showLogoPicker} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
      <Text style={[styles.modalTitle, darkMode && styles.textDark]}>
        Company Logo
      </Text>

      {/* CURRENT LOGO PREVIEW */}
      {logoUri && !hasNoLogo && (
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Image
            source={{ uri: logoUri }}
            style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}
          />
          <Text style={{ marginTop: 8, color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 14 }}>
            Current Logo
          </Text>
        </View>
      )}

      

      {/* REMOVE LOGO */}
      {logoUri && !hasNoLogo && (
        <TouchableOpacity
          style={[styles.logoOption, styles.logoOptionRemove, darkMode && styles.logoOptionDark]}
          onPress={async () => {
            setShowLogoPicker(false);
            await AsyncStorage.removeItem('logoUri');
            await AsyncStorage.setItem('hasNoLogo', 'true');
            setLogoUri(null);
            setHasNoLogo(true);
            showMsg('Logo removed');
          }}
        >
          <Icon name="delete-outline" size={28} color="#dc2626" />
          <Text style={styles.logoOptionRemoveText}>
            Remove Logo
          </Text>
        </TouchableOpacity>
      )}

      {/* USE NO LOGO */}
      {!hasNoLogo && (
        <TouchableOpacity
          style={[styles.logoOption, darkMode && styles.logoOptionDark]}
          onPress={async () => {
            setShowLogoPicker(false);
            await AsyncStorage.removeItem('logoUri');
            await AsyncStorage.setItem('hasNoLogo', 'true');
            setLogoUri(null);
            setHasNoLogo(true);
            showMsg('No logo selected');
          }}
        >
          <Icon name="hide-image" size={28} color="#6366f1" />
          <Text style={[styles.logoOptionText, darkMode && styles.textDark]}>
            Use No Logo
          </Text>
        </TouchableOpacity>
      )}

      {/* CANCEL */}
      <ModalCloseButton onPress={() => setShowLogoPicker(false)} />
      
    </View>
  </View>
</Modal>


      {/* ADD JOB MODAL */}
      <Modal visible={showAddJob} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Add Job Type</Text>
            <TextInput
              style={[styles.modalInput, darkMode && styles.inputDark]}
              placeholder="Job name"
placeholderTextColor={darkMode ? "#94a3b8" : "#9ca3af"}
              value={newJobName}
              onChangeText={setNewJobName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowAddJob(false); setNewJobName(''); }}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOK} onPress={addJob}>
                <Text style={styles.modalBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT JOB MODAL */}
      <Modal visible={showEditJob} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Edit Job Type</Text>
            <TextInput
              style={[styles.modalInput, darkMode && styles.inputDark]}
              value={editJobNew}
              onChangeText={setEditJobNew}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditJob(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOK} onPress={editJob}>
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


{/* ────────────────────────────────────────────────────────────────────── */}
{/* DATABASE MODAL – TAP → CONFIRM LOAD | LONG PRESS → SELECT FOR DELETE */}
{/* ────────────────────────────────────────────────────────────────────── */}
{/* GLOBAL DATABASE — FINAL PERFECTION: BEAUTIFUL CONFIRM + CORRECT DELETE */}
{showDatabase && (
  <Modal
    transparent
    visible={true}
    animationType="fade"
    onRequestClose={() => {
      setShowDatabase(false);
      setGlobalItemSearch('');
      setSelectedForDelete({});
    }}
  >
    {/* FULL-SCREEN BACKDROP — THIS IS THE ONLY THING THAT CLOSES THE MODAL */}
    <TouchableOpacity
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}
      activeOpacity={1}
      onPress={() => {
        setShowDatabase(false);
        setGlobalItemSearch('');
        setSelectedForDelete({});
      }}
    />

    {/* MODAL CONTENT — SITS ON TOP */}
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} pointerEvents="box-none">
      <View style={[
        styles.modalBox,
        darkMode && styles.modalBoxDark,
        { 
          width: '95%', 
          height: '90%', 
          padding: 0, 
          borderRadius: 20, 
          overflow: 'hidden',
          backgroundColor: darkMode ? '#1f2937' : '#ffffff',
        }
      ]}>
        {/* HEADER */}
        <View style={{
          padding: 20,
          backgroundColor: darkMode ? '#1f2937' : '#f8fafc',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>
              Global Items Database ({GLOBAL_ITEMS.length})
            </Text>
            <TouchableOpacity onPress={() => {
              setShowDatabase(false);
              setGlobalItemSearch('');
              setSelectedForDelete({});
            }}>
              <Icon name="close" size={32} color={darkMode ? "#e5e7eb" : "#1f2937"} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[
              styles.input,
              darkMode && styles.inputDark,
              { marginTop: 16 }
            ]}
            placeholder="Search items..."
            placeholderTextColor={darkMode ? "#94a3b8" : "#9ca3af"}
            value={globalItemSearch}
            onChangeText={setGlobalItemSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* ADD TO GLOBAL BUTTON */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: darkMode ? '#374151' : '#e2e8f0' }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#6366f1',
              padding: 18,
              borderRadius: 16,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 12,
            }}
            onPress={() => {
              setShowAddDefaultItem(true);
              setNewItemName('');
              setNewItemPrice('');
            }}
          >
            <Icon name="add-circle" size={28} color="white" />
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 18 }}>
              Add Item to Global Database
            </Text>
          </TouchableOpacity>
        </View>

        {/* FLOATING SELECTION BAR */}
        {Object.keys(selectedForDelete).length > 0 && (
          <View style={{
            position: 'absolute',
            bottom: 40,
            left: 20,
            right: 20,
            backgroundColor: '#dc2626',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderRadius: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 10,
            elevation: 15,
            zIndex: 100,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="skull-outline" size={26} color="white" />
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 18 }}>
                {Object.keys(selectedForDelete).length} selected
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                showConfirm({
                  title: "Delete Forever?",
                  message: `Permanently remove ${Object.keys(selectedForDelete).length} items?`,
                  confirmText: "Delete",
                  destructive: true,
                  onConfirm: () => {
                    const keys = Object.keys(selectedForDelete);
                    const indicesToRemove = keys.map(key => {
                      const filteredIndex = parseInt(key.replace('global-', ''));
                      return GLOBAL_ITEMS.findIndex(
                        (item, origIdx) =>
                          item.name === filteredGlobalItems[filteredIndex]?.name &&
                          item.price === filteredGlobalItems[filteredIndex]?.price
                      );
                    }).filter(idx => idx !== -1);
                    const updated = GLOBAL_ITEMS.filter((_, i) => !indicesToRemove.includes(i));
                    saveGlobalItems(updated);
                    setSelectedForDelete({});
                    showMsg(`${indicesToRemove.length} items deleted`);
                  }
                });
              }}
              style={{
                backgroundColor: 'white',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 16 }}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ITEMS LIST */}
        <FlatList
          data={filteredGlobalItems}
          keyExtractor={(item, index) => `global-${index}`}
          renderItem={({ item, index }) => {
            const key = `global-${index}`;
            const isSelected = !!selectedForDelete[key];
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 18,
                  backgroundColor: isSelected
                    ? (darkMode ? '#374151' : '#fee2e2')
                    : 'transparent',
                  borderBottomWidth: 1,
                  borderBottomColor: darkMode ? '#374151' : '#e2e8f0',
                }}
                onPress={() => {
                  if (Object.keys(selectedForDelete).length === 0) {
                    // Not in selection mode → edit
                    const originalIndex = GLOBAL_ITEMS.findIndex(
                      i => i.name === item.name && i.price === item.price
                    );
                    setEditGlobalItemIdx(originalIndex);
                    setEditGlobalName(item.name);
                    setEditGlobalPrice(String(item.price));
                    setShowEditGlobalItem(true);
                  } else {
                    // In selection mode → toggle
                    setSelectedForDelete(prev => {
                      const newSel = { ...prev };
                      if (newSel[key]) delete newSel[key];
                      else newSel[key] = true;
                      return Object.keys(newSel).length === 0 ? {} : newSel;
                    });
                  }
                }}
                onLongPress={() => {
                  setSelectedForDelete(prev => {
                    const newSel = { ...prev };
                    if (newSel[key]) delete newSel[key];
                    else newSel[key] = true;
                    return Object.keys(newSel).length === 0 ? {} : newSel;
                  });
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: darkMode ? '#e5e7eb' : '#1f2937',
                    fontSize: 18,
                    fontWeight: isSelected ? 'bold' : '600'
                  }}>
                    {item.name}
                  </Text>
                  <Text style={{
                    color: darkMode ? '#94a3b8' : '#64748b',
                    fontSize: 15
                  }}>
                    ${Number(item.price).toFixed(2)}
                  </Text>
                </View>
                <HartmanLogo 
                  width={35} 
                  height={35} 
                  color={isSelected ? "#dc2626" : "#228B22"} 
                />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 80, alignItems: 'center' }}>
              <Text style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: 17, textAlign: 'center' }}>
                {GLOBAL_ITEMS.length === 0
                  ? "No items yet — add from a job!"
                  : "No items match your search"}
              </Text>
            </View>
          }
        />
      </View>
    </View>
  </Modal>
)}

    

     {/* EDIT ITEM MODAL */}
<Modal visible={showEditItem} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
      <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Edit Item</Text>

      {/* Item Name */}
      <TextInput
        style={[
          styles.modalInput,
          darkMode && styles.inputDark,
          { paddingTop: 16, paddingBottom: 16 } // ← Fixes squish
        ]}
        value={editItemName}
        onChangeText={setEditItemName}
        placeholder="Item name"
        placeholderTextColor={darkMode ? '#9ca3af' : '#6b7280'}
      />

      {/* Quantity */}
      <TextInput
        style={[styles.modalInput, darkMode && styles.inputDark]}
        value={editItemQty}
        onChangeText={setEditItemQty}
        placeholder="Qty"
        keyboardType="numeric"
        placeholderTextColor={darkMode ? '#9ca3af' : '#6b7280'}
      />

      {/* Price */}
      <TextInput
        style={[styles.modalInput, darkMode && styles.inputDark]}
        value={editItemPrice}
        onChangeText={setEditItemPrice}
        placeholder="Price"
        keyboardType="numeric"
        placeholderTextColor={darkMode ? '#9ca3af' : '#6b7280'}
      />

      <View style={styles.modalActions}>
        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditItem(false)}>
          <Text style={styles.modalBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalOK} onPress={editItem}>
          <Text style={styles.modalBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

      {/* ITEM PICKER (EDIT) */}
      <Modal visible={showEditItemPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.dropdownBox, darkMode && styles.dropdownBoxDark]}>
            <TextInput
              style={[styles.dropdownSearch, darkMode && styles.dropdownSearchDark]}
              placeholder="Search items..."
              value={globalItemSearch}
              onChangeText={setGlobalItemSearch}
              autoFocus
            />
            <FlatList
              data={filteredGlobalItems}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.dropdownItem, darkMode && { borderBottomColor: '#444' }]}
                  onPress={() => {
                    setEditItemName(item.name);
                    setEditItemPrice(String(item.price));
                    setShowEditItemPicker(false);
                    setGlobalItemSearch('');
                  }}
                >
                  <Text style={{ color: darkMode ? '#e5e7eb' : '#1f2937' }}>{item.name} @ ${item.price}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{
                  padding: 16,
                  textAlign: 'center',
                  color: darkMode ? '#bbb' : '#666'
                }}>
                  No items found
                </Text>
              }
            />
            <TouchableOpacity style={styles.modalCancel} onPress={() => {
              setShowEditItemPicker(false);
              setGlobalItemSearch('');
            }}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
{/* LABOR MODAL - Fixed Layout Version */}
<Modal visible={showLabor} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={[styles.modalBox, { width: '92%', maxWidth: 420 }, darkMode && styles.modalBoxDark]}>
      <Text style={[styles.modalTitle, darkMode && styles.textDark]}>
        Labor Rates & Hours
      </Text>

      {/* Currency Selector */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontWeight: '600', color: darkMode ? '#e5e7eb' : '#374151', marginBottom: 8 }}>
          Currency
        </Text>
        <View style={{
          borderWidth: 1,
          borderColor: darkMode ? '#374151' : '#e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: darkMode ? '#1f2937' : '#f8fafc'
        }}>
          <Picker
            selectedValue={selectedCurrency || 'USD'}
            onValueChange={(val) => setSelectedCurrency(val)}
            style={{ height: 50, color: darkMode ? '#e5e7eb' : '#1f2937' }}
            dropdownIconColor={darkMode ? '#cbd5e1' : '#64748b'}
          >
            <Picker.Item label="USD - US Dollar ($)" value="USD" />
            <Picker.Item label="EUR - Euro (€)" value="EUR" />
            <Picker.Item label="GBP - British Pound (£)" value="GBP" />
            <Picker.Item label="CAD - Canadian Dollar (C$)" value="CAD" />
            <Picker.Item label="AUD - Australian Dollar (A$)" value="AUD" />
            <Picker.Item label="JPY - Japanese Yen (¥)" value="JPY" />
            <Picker.Item label="CHF - Swiss Franc (CHF)" value="CHF" />
            <Picker.Item label="NZD - New Zealand Dollar (NZ$)" value="NZD" />
          </Picker>
        </View>
      </View>

      {/* Labor Type Selector */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontWeight: '600', color: darkMode ? '#e5e7eb' : '#374151', marginBottom: 8 }}>
          Labor Type
        </Text>
        <View style={{
          borderWidth: 1,
          borderColor: darkMode ? '#374151' : '#e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: darkMode ? '#1f2937' : '#f8fafc'
        }}>
          <Picker
            selectedValue={selectedLaborType || 'standard'}
            onValueChange={(val) => {
              setSelectedLaborType(val);
              const rates = laborRates[selectedCurrency] || {};
              if (val === 'standard') {
                setTempSH(String(rates.standardHours || ''));
                setTempSR(String(rates.standardRate || '105'));
              } else if (val === 'ot') {
                setTempOH(String(rates.otHours || ''));
                setTempOR(String(rates.otRate || '157.5'));
              } else if (val === 'travel') {
                setTempTH(String(rates.travelHours || ''));
                setTempTR(String(rates.travelRate || '105'));
              }
            }}
            style={{ height: 50, color: darkMode ? '#e5e7eb' : '#1f2937' }}
          >
            <Picker.Item label="Standard Time" value="standard" />
            <Picker.Item label="Overtime (OT)" value="ot" />
            <Picker.Item label="Travel Time" value="travel" />
          </Picker>
        </View>
      </View>

      {/* Hours & Rate Inputs - FIXED */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: darkMode ? '#e5e7eb' : '#374151', marginBottom: 8 }}>
            Hours
          </Text>
          <TextInput
            style={[
              styles.modalInput,
              darkMode && styles.inputDark,
              { height: 56, textAlign: 'center', fontSize: 18 }  // ← KEY FIX
            ]}
            placeholder="0"
            placeholderTextColor={darkMode ? "#cbd5e1" : "#9ca3af"}
            value={
              selectedLaborType === 'standard' ? tempSH :
              selectedLaborType === 'ot' ? tempOH : tempTH
            }
            onChangeText={(text) => {
              if (selectedLaborType === 'standard') setTempSH(text);
              else if (selectedLaborType === 'ot') setTempOH(text);
              else setTempTH(text);
            }}
            keyboardType="numeric"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: darkMode ? '#e5e7eb' : '#374151', marginBottom: 8 }}>
            Rate per Hour ({selectedCurrency || 'USD'})
          </Text>
          <TextInput
            style={[
              styles.modalInput,
              darkMode && styles.inputDark,
              { height: 56, textAlign: 'center', fontSize: 18 }  // ← KEY FIX
            ]}
            placeholder={selectedCurrency === 'USD' ? "105" : "105"}
            placeholderTextColor={darkMode ? "#cbd5e1" : "#9ca3af"}
            value={
              selectedLaborType === 'standard' ? tempSR :
              selectedLaborType === 'ot' ? tempOR : tempTR
            }
            onChangeText={(text) => {
              if (selectedLaborType === 'standard') setTempSR(text);
              else if (selectedLaborType === 'ot') setTempOR(text);
              else setTempTR(text);
            }}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.modalActions}>
        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowLabor(false)}>
          <Text style={styles.modalBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalOK} onPress={saveLabor}>
          <Text style={styles.modalBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
      {/* MARKUP MODAL */}
      <Modal visible={showMarkup} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Markup %</Text>
            <TextInput
              style={[styles.modalInput, darkMode && styles.inputDark]}
              value={tempMarkup}
              placeholderTextColor={darkMode ? "#94a3b8" : "#9ca3af"}
              placeholder="Percentage to markup items..."
              onChangeText={setTempMarkup}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowMarkup(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOK} onPress={saveMarkup}>
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* TAX MODAL */}
<Modal visible={showTax} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
      <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Sales Tax %</Text>
      <TextInput
        style={[styles.modalInput, darkMode && styles.inputDark]}
        value={tempTax}
        onChangeText={setTempTax}
        keyboardType="numeric"
        placeholder="e.g. 8.25"
        placeholderTextColor={darkMode ? "#94a3b8" : "#9ca3af"}
      />
      <View style={styles.modalActions}>
        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTax(false)}>
          <Text style={styles.modalBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalOK} onPress={saveTax}>
          <Text style={styles.modalBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

{/* DRAFTS MODAL — ONLY THE CARD IS VISIBLE, EVERYTHING ELSE 100% SEE-THROUGH */}
{/* DRAFTS MODAL — FINAL PERFECTION: Clean, Transparent, Smart Multi-Select, Red Border Only */}

{showTemplates && (
  <Modal transparent visible={showTemplates} animationType="slide">
    {/* BACKDROP — ONLY ONE TOUCHABLE IN THE ENTIRE APP */}
    <TouchableOpacity
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      activeOpacity={1}
      onPress={() => {
        setShowTemplates(false);
        setIsTemplateMultiSelect(false);
        setSelectedTemplates({});
      }}
    />
    <View style={{ flex: 1 }} pointerEvents="box-none">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }} pointerEvents="box-none">
        
        <View
          style={{
            backgroundColor: darkMode ? '#1f2937' : '#ffffff',
            borderRadius: 28,
            borderWidth: 3,
            borderColor: '#10b981',
            shadowColor: '#10b981',
            shadowOpacity: 0.6,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 12 },
            elevation: 40,
            width: '94%',
            maxHeight: '82%',
            paddingBottom: 20,
          }}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <View style={{
            backgroundColor: '#10b981',
            paddingVertical: 22,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: 'white' }}>
              Drafts
            </Text>
          </View>

          <ScrollView style={{ maxHeight: window.height * 0.68, paddingHorizontal: 8 }}>
            {Object.keys(TEMPLATES).length === 0 ? (
              <Text style={{ padding: 50, textAlign: 'center', color: darkMode ? '#94a3b8' : '#64748b', fontStyle: 'italic', fontSize: 18 }}>
                No drafts yet
              </Text>
            ) : (
              Object.keys(TEMPLATES).map((name) => {
                const isSelected = !!selectedTemplates[name];

                return (
                  <TouchableOpacity
                    key={name}
                    activeOpacity={0.8}
                    style={{
                      marginHorizontal: 16,
                      marginVertical: 10,
                      padding: 22,
                      backgroundColor: darkMode ? '#374151' : '#f8fafc',
                      borderRadius: 20,
                      borderWidth: 3,
                      borderColor: isSelected ? '#dc2626' : '#10b981', // RED BORDER ONLY
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onLongPress={() => {
                      setIsTemplateMultiSelect(true);
                      setSelectedTemplates(prev => ({ ...prev, [name]: true }));
                    }}
                    onPress={() => {
                      if (isTemplateMultiSelect) {
                        setSelectedTemplates(prev => ({
                          ...prev,
                          [name]: !prev[name]
                        }));
                      } else {
                        // BEAUTIFUL CONFIRM BEFORE LOADING
                        showConfirm({
                          title: "Load Saved Draft",
                          message: `"${name}"?\n\nThis will replace your current estimate.`,
                          confirmText: "Load",
                          destructive: false,
                          onConfirm: () => {
                            loadTemplate(name);
                            setShowTemplates(false);
                          },
                        });
                      }
                    }}
                  >
                    <Text style={{
                      fontSize: 19,
                      fontWeight: '700',
                      color: darkMode ? '#ecfdf5' : '#065f46',
                      flex: 1,
                    }}>
                      {name}
                    </Text>

                    {isTemplateMultiSelect && (
                      <Ionicons
                        name={isSelected ? "skull-outline" : ""}
                        size={28}
                        color={isSelected ? '#dc2626' : '#10b981'}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* MULTI-SELECT DELETE BAR */}
          {isTemplateMultiSelect && Object.keys(selectedTemplates).some(k => selectedTemplates[k]) && (
            <View style={{
              position: 'absolute',
              bottom: 90,
              left: 20,
              right: 20,
              zIndex: 100,
            }}>
              <TouchableOpacity
                style={{
    backgroundColor: '#dc2626',
    paddingVertical: 14,     // was 18
    paddingHorizontal: 20,   // was nothing → adds side padding
    borderRadius: 16,        // was 20
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,                 // was 12
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 12,        // was 16
    elevation: 16,           // was 20
    position: 'absolute', botton: 30,
    left: 20, right: 20
  }}
                onPress={() => {
  const toDelete = Object.keys(selectedTemplates).filter(k => selectedTemplates[k]);

  showConfirm({
    title: `Delete ${toDelete.length} Draft${toDelete.length > 1 ? 's' : ''}?`,
    message: "This cannot be undone.",
    confirmText: "Delete",
    destructive: true,
    onConfirm: () => {
      deleteTemplate(toDelete);  // ← pass array here
      setSelectedTemplates({});
      setIsTemplateMultiSelect(false);
    },
  });
}}
              >
                <Ionicons name="skull-outline" size={26} color="white" />
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>
                  Delete Selected ({Object.keys(selectedTemplates).filter(k => selectedTemplates[k]).length})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* GREEN CLOSE BUTTON */}
          <TouchableOpacity
            style={{
              marginHorizontal: 32,
              marginTop: isTemplateMultiSelect ? 80 : 20,
              marginBottom: 10,
              padding: 16,
              backgroundColor: '#10b981',
              borderRadius: 18,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
            }}
            onPress={() => {
              setShowTemplates(false);
              setIsTemplateMultiSelect(false);
              setSelectedTemplates({});
            }}
          >
            <Icon name="close" size={26} color="white" />
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 19 }}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
</Modal>
)}


 {/* SAVE TEMPLATE MODAL - Cannot Save Without Name */}
<Modal 
  transparent 
  animationType="fade" 
  visible={showSaveTemplate} 
  onRequestClose={() => {
    setShowSaveTemplate(false);
    setTemplateName('');
  }}
>
  <View style={styles.modalOverlay}>
    <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
      <Text style={[styles.modalTitle, darkMode && styles.textDark]}>
        Save as Draft
      </Text>

      <TextInput
        style={[styles.modalInput, darkMode && styles.inputDark]}
        placeholder="Enter draft title..."
        placeholderTextColor={darkMode ? '#9ca3af' : '#6b7280'}
        value={templateName}
        onChangeText={setTemplateName}
        autoFocus={true}
        selectTextOnFocus={true}
        clearButtonMode="while-editing"
        returnKeyType="done"
      />

      <View style={styles.modalActions}>
        <TouchableOpacity 
          style={styles.modalCancel} 
          onPress={() => {
            setShowSaveTemplate(false);
            setTemplateName('');
          }}
        >
          <Text style={styles.modalBtnText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onLayout={(event) => {
            const { y } = event.nativeEvent.layout;
            setHelpPositions(prev => ({ ...prev, saveTemplate: { y } }));
          }}
          style={[
            styles.modalOK,
            { opacity: templateName.trim() ? 1 : 0.5 }  // Dim when empty
          ]}
          disabled={!templateName.trim()}  // ← THIS PREVENTS SAVING WITHOUT NAME
         onPress={() => {
  if (!templateName.trim()) {
    showMsg('Please enter a template title');
    return;
  }

  // === PRO GATE — UNLIMITED TEMPLATES ===
  if (!isPro && Object.keys(TEMPLATES).length >= 3) {
    setShowPaywall(true);
    showQuickToast('Unlimited templates are a Pro feature');
    return;
  }

  saveCurrentTemplate();
}}
        >
          <Text style={styles.modalBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

      {/* CONFIRM DELETE JOBS */}
      <Modal visible={showDeleteJobsConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Delete {selectedJobs.length} Jobs?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDeleteJobsConfirm(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDelete} onPress={confirmDeleteJobs}>
                <Text style={styles.modalBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CONFIRM DELETE ITEMS */}
      <Modal visible={showItemDeleteConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Delete {itemDeleteCount} Items?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowItemDeleteConfirm(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDelete} onPress={confirmDeleteItems}>
                <Text style={styles.modalBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CLEAR ESTIMATE CONFIRM */}
      <Modal visible={showClearConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>{isInvoiceMode ? 'Clear Invoice?' : 'Clear Estimate?'}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowClearConfirm(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
                 
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDelete} onPress={confirmClearEstimate}>
               
                <Ionicons name="skull-outline" size={22} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* NAME REQUIRED */}
      <Modal visible={showNameRequired} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>Customer Name Required</Text>
            <TouchableOpacity onPress={() => setShowNameRequired(false)}>
  <Text style={[styles.modalBtnText, !darkMode && styles.modalCloseTextLight]}>
    OK
  </Text>
</TouchableOpacity>
          </View>
        </View>
      </Modal>

    

      {/* PDF PREVIEW */}
      <Modal visible={showPreview} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.textDark]}>PDF Ready</Text>
            <View 
  
  style={{ flexDirection: 'row', gap: 12, marginTop: 16,
          backgroundColor: isInvoiceMode ? '#fefce8' : (darkMode ? '#1e293b' : '#f1f5f9'),
          paddingVertical: 19,
          paddingHorizontal: 16,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: isInvoiceMode ? '#fCD34D' : 'transparent',
        }}
>




              <TouchableOpacity style={styles.sendBtn} onPress={sendPDF}>
                <Icon name="share" size={24} color="white" />
                <Text style={styles.sendBtnText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={printPDF}>
                <Icon name="print" size={24} color="white" />
                <Text style={styles.saveBtnText}>Print</Text>
              </TouchableOpacity>
            </View>
            <ModalCloseButton onPress={() => setShowPreview(false)} />
          </View>
        </View>
      </Modal>
      
      {/* ── CUSTOM CONFIRM MODAL ── */}
<Modal visible={showConfirmModal} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
      <Text style={[styles.modalTitle, darkMode && styles.textDark]}>
        {confirmModal.title}
      </Text>
      <Text style={{ color: darkMode ? '#e5e7eb' : '#1f2937', textAlign: 'center', marginBottom: 20 }}>
        {confirmModal.message}
      </Text>
      <View style={styles.modalActions}>
        <TouchableOpacity
          style={styles.modalCancel}
          onPress={() => {
            setShowConfirmModal(false);
            confirmModal.onCancel?.();
          }}
        >
          <Text style={styles.modalBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalOK, confirmModal.destructive && { backgroundColor: '#dc2626' }]}
          onPress={() => {
            setShowConfirmModal(false);
            confirmModal.onConfirm();
          }}
        >
          <Text style={styles.modalBtnText}>
            {confirmModal.confirmText || 'OK'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

{/* SETTINGS SLIDE-IN PANEL — FINAL, LOGO IN PREVIEW */}
{showSettingsPanel && (
  <Modal transparent visible={true} animationType="none" onRequestClose={() => setShowSettingsPanel(false)}>
    {/* FULL-SCREEN BACKDROP */}
    <TouchableOpacity
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}
      activeOpacity={1}
      onPress={() => setShowSettingsPanel(false)}
    />

    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1 }} />

      <View style={{
        width: '88%',
        backgroundColor: darkMode ? '#111' : '#fff',
        shadowColor: '#000',
        shadowOffset: { width: -10, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 30,
        borderTopLeftRadius: 28,
        borderBottomLeftRadius: 28,
      }}>
        {/* LIVE PREVIEW HEADER WITH TAPPABLE LOGO */}
        <View style={{
          paddingTop: 60,
          paddingBottom: 32,
          backgroundColor: '#10b981',
          alignItems: 'center',
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}>
          <Animated.View style={{
            transform: [{ scale: previewAnim }],
            opacity: previewAnim.interpolate({ inputRange: [0.95, 1], outputRange: [0.98, 1] })
          }}>
            {/* TAPPABLE LOGO AREA */}
            <TouchableOpacity
             onPress={async () => {
    if (isPro) {
      // Pro user — allow logo pick
      pickLogo();
    } else {
      // Free user — show paywall
      setShowPaywall(true);
      
    }
  }}
              activeOpacity={0.8}
              style={{
                width: 120,
                height: 120,
                borderRadius: 30,
                backgroundColor: 'rgba(255,255,255,0.15)',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.3)',
                borderStyle: logoUri && !hasNoLogo ? 'solid' : 'dashed',
                overflow: 'hidden',
              }}
            >
              {logoUri && !hasNoLogo ? (
                <Image
                  source={{ uri: logoUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                  key={logoUri}
                />
              ) : (
                <>
                  <Icon name="add-photo-alternate" size={48} color="rgba(255,255,255,0.7)" />
                  <Text style={{ color: 'white', fontSize: 12, marginTop: 8, fontWeight: '600' }}>
                    Tap to add logo
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={{
              fontSize: 28,
              fontWeight: '900',
              color: 'white',
              textAlign: 'center',
              letterSpacing: 0.5,
              marginTop: 20,
            }}>
              {companyName || 'Your Company'}
            </Text>

            {(companyPhone || companyAddress) && (
              <Text style={{
                fontSize: 15.5,
                color: 'rgba(255,255,255,0.95)',
                marginTop: 10,
                textAlign: 'center',
                fontWeight: '600',
              }}>
                {companyPhone ? formatPhoneNumber(companyPhone) : ''}
                {companyPhone && companyAddress ? ' • ' : ''}
                {companyAddress ? companyAddress.split('\n')[0] : ''}
              </Text>
            )}
          </Animated.View>

          {/* Close Button */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              right: 20,
              top: 60,
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: 20,
              padding: 8,
            }}
            onPress={() => setShowSettingsPanel(false)}
          >
            <Icon name="close" size={28} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ padding: 20 }}>
          {/* Company Name */}
          <Text style={[styles.title, darkMode && styles.textDark]}>Company/Business Name</Text>
          <TextInput
            style={[styles.input, darkMode && styles.inputDark]}
            value={companyName}
            onChangeText={async (text) => {
              setCompanyName(text);
              triggerPreviewAnimation();
              await AsyncStorage.setItem('companyName', text);
            }}
            placeholder="e.g. Hartman Electric"
            placeholderTextColor={darkMode ? '#94a3b8' : '#9ca3af'}
          />

          {/* Company Phone */}
          <Text style={[styles.title, darkMode && styles.textDark, { marginTop: 20 }]}>Company Phone</Text>
          <TextInput
            style={[styles.input, darkMode && styles.inputDark]}
            value={companyPhone ? formatPhoneNumber(companyPhone) : ''}
            onChangeText={async (text) => {
              triggerPreviewAnimation();
              const rawDigits = text.replace(/\D/g, '').slice(0, 10);
              setCompanyPhone(rawDigits);
              await AsyncStorage.setItem('companyPhone', rawDigits);
            }}
            placeholder="(555) 123-4567"
            keyboardType="phone-pad"
            maxLength={14}
            placeholderTextColor={darkMode ? '#94a3b8' : '#9ca3af'}
          />

          {/* Company Address */}
          <Text style={[styles.title, darkMode && styles.textDark, { marginTop: 20 }]}>
            Company Address
          </Text>
          <TextInput
            style={[styles.input, darkMode && styles.inputDark, { height: 110, textAlignVertical: 'top', paddingTop: 14 }]}
            value={companyAddress}
            onChangeText={async (text) => {
              triggerPreviewAnimation();
              setCompanyAddress(text);
              await AsyncStorage.setItem('companyAddress', text);
            }}
            placeholder="123 Main Street\nSuite 200\nSpringfield, IL 62704"
            placeholderTextColor={darkMode ? '#94a3b8' : '#9ca3af'}
            multiline
            numberOfLines={5}
            autoCapitalize="words"
          />

          {/* Notification Email */}
          <Text style={[styles.title, darkMode && styles.textDark, { marginTop: 20 }]}>
            Notification Email
          </Text>
          <TextInput
            style={[styles.input, darkMode && styles.inputDark]}
            value={contractorEmail}
            onChangeText={async (text) => {
              setContractorEmail(text);
              await AsyncStorage.setItem('contractorEmail', text);
            }}
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={darkMode ? '#94a3b8' : '#9ca3af'}
          />

          {/* REMOVE LOGO BUTTON — only if logo exists */}
          {logoUri && !hasNoLogo && (
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#86efac',
                  paddingHorizontal: 32,
                  paddingVertical: 14,
                  borderRadius: 16,
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'center',
                }}
                onPress={async () => {
                  setHasNoLogo(true);
                  setLogoUri(null);
                  triggerPreviewAnimation();
                  await AsyncStorage.setItem('hasNoLogo', 'true');
                  await AsyncStorage.removeItem('logoUri');
                  showMsg('Logo removed');
                }}
              >
                <Ionicons name="skull-outline" size={24} color="white" />
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>
                  Remove Logo
                </Text>
              </TouchableOpacity>
              

            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </View>
  </Modal>
)}


{/* BEAUTIFUL DOCUMENT ACTION SHEET */}
<Modal visible={showDocumentActionSheet} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
      {currentDocForActions && (
        <>
          <Text style={[styles.modalTitle, darkMode && styles.textDark]}>
            {currentDocForActions.type === 'invoice'
              ? `Invoice #${currentDocForActions.invoiceNumber || ''}`
              : `Estimate #E-${currentDocForActions.invoiceNumber || ''}`}
          </Text>
          <Text style={{ textAlign: 'center', color: darkMode ? '#94a3b8' : '#64748b', marginBottom: 20 }}>
            What would you like to do with this file?
          </Text>

          <View style={{ gap: 12 }}>
            {[
              { icon: "share-social", color: "#6366f1", text: "Share",      action: () => { setShowDocumentActionSheet(false); Sharing.shareAsync(currentDocForActions.pdfUri); } },
              { icon: "print", color: "#f59e0b", text: "View/Print", action: () => { setShowDocumentActionSheet(false); printPDF(currentDocForActions.pdfUri); } },
              {
  icon: "download",
  color: "#dc2626",
  text: "Save to device…",
  action: async () => {
    setShowDocumentActionSheet(false);   // close the small action sheet
    setShowHistory(false);               // <<< THIS IS THE MAGIC LINE

    // Wait for the History panel to fully disappear
    setTimeout(async () => {
      try {
        const filename = (currentDocForActions.type === 'invoice'
          ? `Invoice_${currentDocForActions.invoiceNumber}_${currentDocForActions.customerName || 'Customer'}`
          : `Estimate_E-${currentDocForActions.invoiceNumber}_${currentDocForActions.customerName || 'Customer'}`
        ).replace(/[<>:"/\\|?*]/g, '_') + '.pdf';

        const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!result.granted) {
          Toast.show({ type: 'success', text1: 'Permission denied' });
          return;
        }

        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          result.directoryUri,
          filename,
          'application/pdf'
        );

        const base64 = await FileSystem.readAsStringAsync(currentDocForActions.pdfUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Success toast – now appears on the main screen, never hidden
        Toast.show({
          type: 'success',
          text1: 'Saved successfully!',
          text2: filename,
          visibilityTime: 3000,
        });
      } catch (err) {
        Toast.show({ type: 'success', text1: 'Save failed' });
      }
    }, 450); // 450 ms is perfect for the slide-out animation
  }
}
              
            ].map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={{
                  backgroundColor: darkMode ? '#1f2937' : '#f8fafc',
                  padding: 18,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  borderWidth: 2,
                  borderColor: btn.color + '40',
                }}
                onPress={btn.action}
              >
                <Ionicons name={btn.icon} size={28} color={btn.color} />
                <Text style={{ fontSize: 18, fontWeight: '600', color: darkMode ? '#e5e7eb' : '#1f2937', flex: 1 }}>
                  {btn.text}
                </Text>
                <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={{ marginTop: 24 }}
            onPress={() => setShowDocumentActionSheet(false)}
          >
            <Text style={{ color: '#dc2626', fontWeight: 'bold', textAlign: 'center', fontSize: 17 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  </View>
</Modal>


{/* HISTORY PANEL — FINAL, NO MORE GHOST TAPS */}
{showHistory && (
  <Modal
    transparent
    visible={true}
    animationType="slide"
    onRequestClose={() => {
      setShowHistory(false);
      setIsHistoryMultiSelect(false);
      setSelectedHistoryIds({});
    }}
  >
    {/* FULL-SCREEN BACKDROP — ONLY ONE TOUCHABLE */}
    <TouchableOpacity
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)' }}
      activeOpacity={1}
      onPress={() => {
        setShowHistory(false);
        setIsHistoryMultiSelect(false);
        setSelectedHistoryIds({});
      }}
    />

    {/* ACTUAL PANEL — SITS ON TOP, NO TOUCH STEALING */}
    <View style={{ 
      flex: 1, 
      marginTop: 80,
      backgroundColor: darkMode ? '#111827' : '#f8fafc',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden'
    }}>
       
       
       {/* Header + Multi-Select Bar */}
<View style={{ backgroundColor: darkMode ? '#111827' : '#ffffff' }}>
  {!isHistoryMultiSelect ? (
    /* Normal Header */
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, paddingHorizontal: 24, paddingBottom: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: '900', color: '#10b981' }}>History</Text>
      <TouchableOpacity onPress={() => setShowHistory(false)}>
        <Icon name="close" size={34} color={darkMode ? 'white' : '#1f2937'} />
      </TouchableOpacity>
    </View>
  ) : (
    /* Multi-Select Action Bar */
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 }}>
    
    
    
      {/* Select All / Deselect All Button */}
      <TouchableOpacity
        onPress={() => {
          const visibleDocs = allDocuments
            .filter(doc => {
              if (doc.archived && historyFilter !== 'archived') return false;
              if (historyFilter === 'all') return true;
              if (historyFilter === 'active') return !doc.archived && doc.status !== 'paid';
              if (historyFilter === 'paid') return doc.status === 'paid';
              if (historyFilter === 'overdue') {
                return doc.type === 'invoice' &&
                       doc.status !== 'paid' &&
                       doc.dueDate &&
                       new Date(doc.dueDate) < new Date();
              }
              if (historyFilter === 'archived') return doc.archived;
              return true;
            });

          const visibleCount = visibleDocs.length;

          if (Object.keys(selectedHistoryIds).length === visibleCount && visibleCount > 0) {
            setSelectedHistoryIds({});
          } else {
            const newSelection = {};
            visibleDocs.forEach(doc => {
              newSelection[doc.id] = true;
            });
            setSelectedHistoryIds(newSelection);
          }
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: 'grey',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 20,
        }}
      >
        <Icon
          name={
            Object.keys(selectedHistoryIds).length === allDocuments.filter(doc => {
              if (doc.archived && historyFilter !== 'archived') return false;
              if (historyFilter === 'all') return true;
              if (historyFilter === 'active') return !doc.archived && doc.status !== 'paid';
              if (historyFilter === 'paid') return doc.status === 'paid';
              if (historyFilter === 'overdue') {
                return doc.type === 'invoice' &&
                       doc.status !== 'paid' &&
                       doc.dueDate &&
                       new Date(doc.dueDate) < new Date();
              }
              if (historyFilter === 'archived') return doc.archived;
              return true;
            }).length
              ? "check-box"
              : "check-box-outline-blank"
          }
          size={26}
          color="white"
        />
        <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>
          {Object.keys(selectedHistoryIds).length === allDocuments.filter(doc => {
            if (doc.archived && historyFilter !== 'archived') return false;
            if (historyFilter === 'all') return true;
            if (historyFilter === 'active') return !doc.archived && doc.status !== 'paid';
            if (historyFilter === 'paid') return doc.status === 'paid';
            if (historyFilter === 'overdue') {
              return doc.type === 'invoice' &&
                     doc.status !== 'paid' &&
                     doc.dueDate &&
                     new Date(doc.dueDate) < new Date();
            }
            if (historyFilter === 'archived') return doc.archived;
            return true;
          }).length
            ? 'Deselect'
            : 'Select'} All
        </Text>
      </TouchableOpacity>

      {/* Selected Count + Delete Button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '900', color: darkMode ? '#e5e7eb' : '#1f2937' }}>
          ({Object.keys(selectedHistoryIds).length})
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (Object.keys(selectedHistoryIds).length === 0) {
              showMsg('Select documents to delete');
              return;
            }
            showConfirm({
              title: `Delete ${Object.keys(selectedHistoryIds).length} Document${Object.keys(selectedHistoryIds).length > 1 ? 's' : ''}?`,
              message: 'This action cannot be undone.',
              confirmText: 'Delete Forever',
              destructive: true,
             onConfirm: async () => {
  try {
    // Remove all selected documents
    const updatedDocs = allDocuments.filter(d => !selectedHistoryIds[d.id]);

    // Update state immediately
    setAllDocuments(updatedDocs);

    // === TRY BACKEND ===
    try {
      await fetch('https://hartman-estimate.vercel.app/api/save-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDocs),
      });
      console.log('Bulk delete synced to backend');
    } catch (err) {
      console.warn('Backend bulk delete failed — saved locally', err);
    }

    // === ALWAYS SAVE LOCALLY ===
    try {
      await AsyncStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
    } catch (err) {
      console.error('Local save failed after bulk delete!', err);
      showMsg('Deleted in app, but sync failed');
      return;
    }

    // Reset multi-select mode
    setSelectedHistoryIds({});
    setIsHistoryMultiSelect(false);

    // Success feedback
    Toast.show({
      type: 'success',
      text1: 'Deleted!',
      text2: `${Object.keys(selectedHistoryIds).length} document${Object.keys(selectedHistoryIds).length > 1 ? 's' : ''} removed`,
    });

  } catch (err) {
    console.error('Bulk delete failed:', err);
    showMsg('Delete failed');
  }
},
            });
          }}
          style={{
            backgroundColor: '#dc2626',
            padding: 14,
            borderRadius: 20,
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 10,
            elevation: 8,
          }}
        >
          <Ionicons name="skull-outline" size={26} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  )}
</View>
       
       
       
{/* Filters */}
<View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 16, gap: 12, flexWrap: 'wrap', backgroundColor: darkMode ? '#111827' : '#ffffff' }}>
  {['all', 'active', 'paid', 'overdue', 'archived'].map(filter => (
    <TouchableOpacity
      key={filter}
      onPress={() => setHistoryFilter(filter)}
      style={{
        backgroundColor: historyFilter === filter ? '#10b981' : (darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'),
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 20,
      }}
    >
      <Text style={{ color: historyFilter === filter ? 'white' : (darkMode ? '#e5e7eb' : '#374151'), fontWeight: '700', fontSize: 15 }}>
        {filter.charAt(0).toUpperCase() + filter.slice(1)}
      </Text>
    </TouchableOpacity>
  ))}
</View>


<FlatList
  data={allDocuments
    .filter(doc => {
      // Always exclude archived from "all" and other main tabs
      if (doc.archived && historyFilter !== 'archived') return false;

      if (historyFilter === 'all') return true; // now only non-archived
      if (historyFilter === 'active') return !doc.archived && doc.status !== 'paid';
      if (historyFilter === 'paid') return doc.status === 'paid';
      if (historyFilter === 'overdue') {
        return doc.type === 'invoice' && 
               doc.status !== 'paid' && 
               doc.dueDate && 
               new Date(doc.dueDate) < new Date();
      }
      if (historyFilter === 'archived') return doc.archived;

      return true;
    })
    .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
  }
  keyExtractor={doc => doc.id}
renderItem={({ item: doc }) => {
  const isSelected = selectedHistoryIds[doc.id];
  const isOverdue = doc.type === 'invoice' && doc.status !== 'paid' && doc.dueDate && new Date(doc.dueDate) < new Date();
  const isPaid = doc.status === 'paid';
  const isArchived = doc.archived;
  const isConverted = !!doc.originalEstimateId;
  const openDocument = async () => {
    if (doc.pdfUri) {
      setPdfUri(doc.pdfUri);
      setCurrentDocForActions(doc);
      setShowDocumentActionSheet(true);
    } else {
      showMsg('Generating PDF...');
      // your PDF generation logic here
    }
  };

  const convertToInvoice = () => {
    showConfirm({
      title: "Convert to Invoice?",
      message: `Estimate #E-${doc.invoiceNumber}\n${doc.customer?.name || 'Customer'}\nAmount: ${getCurrencySymbol()}${doc.amount?.toFixed(2) || '0.00'}\n\nThis will create an invoice and archive the estimate.`,
      confirmText: "Convert & Archive",
      onConfirm: async () => {
        setIsGeneratingPayment(true);
        try {
          const result = await generateDocumentPdf({
            isInvoice: true,
            invoiceNumber: doc.invoiceNumber,
            customer: doc.customer || {},
            companyName,
            companyAddress,
            companyPhone,
            contractorEmail,
            logoUri,
            jobs: doc.jobs || [],
            itemsByJob: doc.itemsByJob || {},
            notes: doc.notes || '',
            jobsitePhotos: doc.jobsitePhotos || [],
            labor: doc.labor || {},
            rates: doc.rates || {},
            markupPercent: doc.markupPercent || 0,
            taxPercent: doc.taxPercent || 0,
            grandTotalOverride: doc.grandTotal || doc.amount,
            overridePaymentUrl: doc.paymentUrl,
          });
          const archivedEstimate = {
            ...doc,
            archived: true,
            type: 'estimate',
          };
          const newInvoice = {
            ...doc,
            id: Date.now().toString(),
            type: 'invoice',
            invoiceNumber: doc.invoiceNumber,
            originalEstimateId: doc.id,
            createdDate: new Date().toISOString(),
            status: 'unpaid',
            pdfUri: result.pdfUri,
            paymentUrl: result.paymentUrl || doc.paymentUrl || null,
            paymentStatus: result.paymentUrl ? 'pending' : null,
            archived: false,
          };
          const updatedDocs = allDocuments.map(d =>
            d.id === doc.id ? archivedEstimate : d
          );
          updatedDocs.unshift(newInvoice);
          setAllDocuments(updatedDocs);
          try {
            await fetch('https://hartman-estimate.vercel.app/api/save-documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedDocs),
            });
            console.log('Convert to invoice synced to backend');
          } catch (err) {
            console.warn('Backend sync failed — saved locally', err);
          }
          try {
            await AsyncStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
          } catch (err) {
            console.error('Local save failed after conversion!', err);
            showMsg('Converted in app, but sync failed');
          }
          showQuickToast(
            `Converted! Invoice #${doc.invoiceNumber} created${result.paymentUrl ? ' • Payment link attached' : ''}`
          );
        } catch (err) {
          console.error('Conversion failed:', err);
          showMsg('Conversion failed — check connection or Stripe');
        } finally {
          setIsGeneratingPayment(false);
        }
      },
    });
  };
  const markAsPaid = () => {
    showConfirm({
      title: "Mark as Paid?",
      message: `Invoice #${doc.invoiceNumber}\n${doc.customerName || 'Customer'}\nAmount: ${getCurrencySymbol()}${doc.amount?.toFixed(2) || '0.00'}`,
      confirmText: "Mark as Paid",
      onConfirm: async () => {
        try {
          const updatedDocs = allDocuments.map(d =>
            d.id === doc.id ? { ...d, status: 'paid' } : d
          );
          setAllDocuments(updatedDocs);
          try {
            await fetch('https://hartman-estimate.vercel.app/api/save-documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedDocs),
            });
            console.log('Marked as paid — synced to backend');
          } catch (err) {
            console.warn('Backend sync failed — saved locally only', err);
          }
          try {
            await AsyncStorage.setItem('allDocuments', JSON.stringify(updatedDocs));
          } catch (err) {
            console.error('Local save failed after marking paid!', err);
            showMsg('Marked as paid in app, but sync failed');
            return;
          }
          Toast.show({
            type: 'success',
            text1: 'Marked as paid! 💰',
          });
        } catch (err) {
          console.error('Unexpected error marking invoice as paid:', err);
          showMsg('Failed to mark as paid');
        }
      },
    });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={{
        backgroundColor: isSelected
          ? (darkMode ? '#1e3a8a' : '#e0e7ff')
          : (isArchived || isConverted ? (darkMode ? '#1f2937' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.08)' : '#ffffff')),
        marginHorizontal: 20,
        marginVertical: 8,
        padding: 20,
        borderRadius: 20,
        borderWidth: isSelected ? 4 : 0,
        borderColor: isSelected ? '#6366f1' : 'transparent',
        borderLeftWidth: isSelected ? 0 : 6,
        borderLeftColor: !isSelected ? (doc.type === 'invoice' ? '#6366f1' : '#10b981') : 'transparent',
        opacity: isArchived ? 0.7 : 1,
        elevation: isSelected ? 20 : 6,
        position: 'relative',
      }}
      onPress={() => {
        if (isHistoryMultiSelect) {
          setSelectedHistoryIds(prev => {
            const newSelection = { ...prev };
            if (newSelection[doc.id]) {
              delete newSelection[doc.id];
            } else {
              newSelection[doc.id] = true;
            }
            return newSelection;
          });
        } else {
          openDocument();
        }
      }}
      onLongPress={() => {
        if (!isHistoryMultiSelect) {
          setIsHistoryMultiSelect(true);
        }
        setSelectedHistoryIds(prev => ({
          ...prev,
          [doc.id]: true
        }));
      }}
    >
      {/* SMALL LINK ICON — TOP LEFT */}
      {doc.type === 'invoice' && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            const currentTotal = doc.grandTotal ?? doc.amount ?? 0;
            const isZeroAmount = currentTotal === 0;
            const isTooLarge = currentTotal >= 1000000;
            const isEligibleForLink =
              doc.type === 'invoice' &&
              doc.status !== 'paid' &&
              !doc.archived &&
              !doc.paymentUrl &&
              !isZeroAmount &&
              !isTooLarge;
            if (isZeroAmount || isTooLarge) {
              showQuickToast(
                isZeroAmount
                  ? 'Balance is $0 ➜ add items or labor to enable payment link'
                  : 'Amount too high ⚠️ payment links not available over $50,000'
              );
              return;
            }
            if (!isPro) {
              setShowPaywall(true);
              showQuickToast('Payment links are a Pro feature');
              return;
            }
            if (!isStripeConnected) {
              const clientId = 'ca_Td84AN3WWsoqlUNxi5iOafDNFSAtjX5c';
              const redirectUri = 'https://hartman-estimate.vercel.app/api/stripe-callback';
              const authUrl = `https://connect.stripe.com/oauth/authorize`
                + `?response_type=code`
                + `&client_id=${clientId}`
                + `&scope=read_write`
                + `&redirect_uri=${encodeURIComponent(redirectUri)}`
                + `&state=hartman_estimate_v1`;
              Linking.openURL(authUrl);
              AsyncStorage.setItem('pendingAttachDocId', doc.id);
              return;
            }
            if (isEligibleForLink) {
              generatePaymentLink(doc);
            }
          }}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 10,
            backgroundColor: 'rgba(255,255,255,0.8)',
            padding: 8,
            borderRadius: 20,
          }}
        >
          <Ionicons
            name={doc.paymentUrl ? 'link' : 'link-outline'}
            size={20}
            color={doc.paymentUrl ? '#6366f1' : '#9ca3af'}
          />
        </TouchableOpacity>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: isSelected ? '#fcd34d' : (darkMode ? 'white' : '#1f2937'), fontWeight: 'bold', fontSize: 19 }}>
            {doc.type === 'invoice' ? `Invoice #${doc.invoiceNumber}` : `Estimate #E-${doc.invoiceNumber}`}
          </Text>
          <Text style={{ color: darkMode ? '#94a3b8' : '#64748b', marginTop: 4 }}>
            {doc.customerName || 'No Customer'}
          </Text>
          <Text style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: 13, marginTop: 4 }}>
            {new Date(doc.createdDate).toLocaleDateString()}
          </Text>

          {/* DUE DATE */}
          {doc.type === 'invoice' && doc.dueDate && (
            <Text style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: 13, marginTop: 4 }}>
              Due: {new Date(doc.dueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: isSelected ? '#fcd34d' : (darkMode ? 'white' : '#1f2937'), fontWeight: 'bold', fontSize: 19 }}>
            {getCurrencySymbol()}{formatPrice(doc.amount || 0)}
          </Text>
        </View>
      </View>

      {/* STATUS BADGE — BOTTOM RIGHT */}
      {doc.type === 'invoice' && (
        <View style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          backgroundColor: isPaid ? '#10b981' : isOverdue ? '#92400e' : '#6366f1',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 8,
        }}>
          {isPaid && <Ionicons name="checkmark-circle" size={18} color="white" />}
          <Text style={{ color: 'white', fontWeight: '900', fontSize: 13 }}>
            {isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'INVOICED'}
          </Text>
        </View>
      )}

      {/* YOUR EXISTING CONVERT BUTTON */}
      {doc.type !== 'invoice' && !doc.archived && !doc.originalEstimateId && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); convertToInvoice(); }}
          style={{
            position: 'absolute',
            top: 60,
            left: 100,
            zIndex: 100,
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            borderWidth: 2,
            borderColor: '#6366f1',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 16,
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
            elevation: 10,
          }}
        >
          <Ionicons name="receipt-outline" size={18} color="#6366f1" />
          <Text style={{
            color: '#6366f1',
            fontWeight: '900',
            fontSize: 14
          }}>
            Convert
          </Text>
        </TouchableOpacity>
      )}

      {/* YOUR EXISTING PAYMENT LINK BUTTON — REMOVED FROM BOTTOM RIGHT TO AVOID OVERLAP */}
      {/* It is now the small icon in top-left */}
    </TouchableOpacity>
  );
}}
          ListEmptyComponent={
            <View style={{ padding: 100, alignItems: 'center' }}>
              <Text style={{ color: darkMode ? '#94a3b8' : '#9ca3af', fontSize: 18, textAlign: 'center', fontStyle: 'italic' }}>
                No documents yet.{'\n'}Generate your first estimate!
              </Text>
            </View>
          }
        />


      </View>
    
  </Modal>
)}


{/* PAYWALL MODAL */}
<Modal
  transparent
  visible={showPaywall}
  animationType="slide"
  onRequestClose={() => setShowPaywall(false)} // ← Android back button closes
>
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
    {/* TOUCH OUTSIDE TO CLOSE */}
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => setShowPaywall(false)}
      style={{ flex: 1 }}
    />

    <View style={{
      backgroundColor: darkMode ? '#1f2937' : '#ffffff',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 32,
      paddingTop: 24,
      maxHeight: '88%',
    }}>
      {/* CLOSE X BUTTON (top right) */}
      <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
        <TouchableOpacity onPress={() => setShowPaywall(false)}>
          <Ionicons name="close" size={32} color={darkMode ? '#9ca3af' : '#64748b'} />
        </TouchableOpacity>
      </View>

      <Text style={{
        fontSize: 32,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 16,
        color: darkMode ? '#f3f4f6' : '#0f172a',
      }}>
        Unlock Pro
      </Text>

      <Text style={{
        fontSize: 17,
        textAlign: 'center',
        marginBottom: 36,
        color: darkMode ? '#cbd5e1' : '#475569',
        lineHeight: 24,
      }}>
        Remove limits and get professional features for your business
      </Text>

      {/* BENEFITS LIST */}
      <View style={{ marginBottom: 40, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={30} color="#10b981" />
          <Text style={{ marginLeft: 14, fontSize: 18, color: darkMode ? '#e5e7eb' : '#1f2937' }}>
            Clean PDFs — (no watermark)
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="card" size={30} color="#10b981" />
          <Text style={{ marginLeft: 14, fontSize: 18, color: darkMode ? '#e5e7eb' : '#1f2937' }}>
            Stripe payment links
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="business" size={30} color="#10b981" />
          <Text style={{ marginLeft: 14, fontSize: 18, color: darkMode ? '#e5e7eb' : '#1f2937' }}>
            Custom logo, company info & branding
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="infinite" size={30} color="#10b981" />
          <Text style={{ marginLeft: 14, fontSize: 18, color: darkMode ? '#e5e7eb' : '#1f2937' }}>
            Unlimited photos, customers, and drafts
          </Text>
        </View>
      </View>

      {/* MAIN UPGRADE BUTTON */}
      <TouchableOpacity
        onPress={purchasePro}
        disabled={offeringsLoading || !proPackage}
        style={{
          backgroundColor: '#10b981',
          paddingVertical: 20,
          borderRadius: 20,
          alignItems: 'center',
          opacity: (offeringsLoading || !proPackage) ? 0.6 : 1,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 22 }}>
          {offeringsLoading ? 'Loading...' : proPackage ? `Upgrade — ${proPackage.product.priceString}/month` : 'Upgrade to Pro'}
        </Text>
        {proPackage && proPackage.product.introPrice && (
          <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 6 }}>
            {proPackage.product.introPriceString} for first period
          </Text>
        )}
        {!offeringsLoading && proPackage && (
          <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 8, fontSize: 15 }}>
            or ${/* calculate yearly savings or hardcode */}49/year (save ~18%)
          </Text>
        )}
      </TouchableOpacity>

      {/* CONTINUE FREE */}
      <TouchableOpacity
        onPress={() => setShowPaywall(false)}
        style={{ alignItems: 'center', padding: 20, marginTop: 8 }}
      >
        <Text style={{ color: darkMode ? '#9ca3af' : '#64748b', fontSize: 17 }}>
          Continue with Free version
        </Text>
      </TouchableOpacity>

      {/* SUBTLE RESTORATION (optional) */}
      <TouchableOpacity style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={{ color: darkMode ? '#64748b' : '#94a3b8', fontSize: 14 }}>
          Restore Purchase
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

{/* CUSTOMER MENU MODAL - Original Look + Toast Inside */}
<Modal visible={showCustomerMenu} transparent animationType="slide">
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => {
      setShowCustomerMenu(false);
      setCustomerModalMessage(''); // clear message when closing
    }} />

    <View style={{
      backgroundColor: darkMode ? '#111827' : '#ffffff',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      maxHeight: '80%',
    }}>
      {/* TOAST MESSAGE - SHOWN ONLY WHEN NEEDED */}
      {customerModalMessage && (
<View style={{ height: customerModalMessage ? 'auto' : 0, marginBottom: 20 }}>
  {/* TOAST MESSAGE - Fade + slide up, no layout jump, no error */}
<View style={{ marginBottom: 20 }}>
  <Animated.View
    pointerEvents="none"
    style={{
      backgroundColor: darkMode ? '#166534' : '#10b981',
      padding: 16,
      borderRadius: 16,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
      borderWidth: 2,
      borderColor: darkMode ? '#22c55e' : '#86efac',
      opacity: toastAnim,
      transform: [
        { scale: toastAnim },
        {
          translateY: toastAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-80, 0],  // Slides up from below when fading out
          }),
        },
      ],
    }}
  >
    <Text style={{
      color: 'white',
      fontWeight: '800',
      fontSize: 17,
      textAlign: 'center',
    }}>
      {customerModalMessage}
    </Text>
  </Animated.View>
</View>
</View>
      )}
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#10b981' }}>Select Customer</Text>
        <TouchableOpacity onPress={() => setShowCustomerMenu(false)}>
          <Icon name="close" size={34} color={darkMode ? 'white' : '#1f2937'} />
        </TouchableOpacity>
      </View>

      {/* Compact Top Options - Two buttons side by side */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        {/* Add New Client */}
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: darkMode ? '#1f2937' : '#f0fdf4',
            paddingVertical: 16,
            paddingHorizontal: 12,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            borderWidth: 2,
            borderColor: '#10b981',
          }}
          onPress={() => {
            setCustomerModalMessage('');
            setShowCustomerMenu(false);
            setEditingCustomerIndex(-1);
            setTempCustomer({ name: '', phone: '', email: '', address: '' });
            setShowAddCustomerForm(true);
          }}
        >
          <Ionicons name="person-add" size={24} color="#10b981" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#10b981' }}>Add New</Text>
        </TouchableOpacity>

        {/* Pull from Contacts */}
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: darkMode ? '#1f2937' : '#f8fafc',
            paddingVertical: 16,
            paddingHorizontal: 12,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            borderWidth: 1.5,              // ← Slim border
    borderColor: '#6366f1',
          }}
          onPress={() => {
  // === PRO GATE — UNLIMITED CUSTOMERS / CONTACT IMPORT ===
  if (!isPro) {
    setShowPaywall(true);
    showQuickToast('Import from contacts is a Pro feature');
    return;
  }

  setCustomerModalMessage('');
  setShowCustomerMenu(false);
  pickFromContacts();
}}
        >
          <Ionicons name="people" size={24} color="#6366f1" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: darkMode ? '#e5e7eb' : '#1f2937' }}>
            Phone Contacts
          </Text>
        </TouchableOpacity>
      </View>

      {/* Saved Customers Header */}
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#f59e0b', marginBottom: 12, textAlign: 'center' }}>
        Customer Database ({customerDatabase.length})
      </Text>

      {/* Search */}
      <TextInput
        placeholder="Search customers..."
        value={customerSearch}
        placeholderTextColor={placeholderColor}
        onChangeText={setCustomerSearch}
        style={[
          styles.input,
          darkMode && styles.inputDark,
          { marginBottom: 16 }
        ]}
      />

      {/* Database List */}
      <ScrollView style={{ maxHeight: 300 }}>
       {customerDatabase
  .filter(c =>
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase())
  )
  .map((cust, i) => (
    <TouchableOpacity
      key={i}
      activeOpacity={0.8}
      onPress={() => {
        setCustomer(cust);
        setShowCustomerMenu(false);
        showMsg(`Loaded: ${cust.name}`);
      }}
      style={{
        padding: 18,
        backgroundColor: darkMode ? '#1f2937' : '#f8fafc',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: darkMode ? '#374151' : '#e2e8f0',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Customer Info - takes full width minus dots */}
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: darkMode ? '#e5e7eb' : '#1f2937' }}>
            {cust.name || 'No Name'}
          </Text>
          {cust.phone && <Text style={{ color: '#64748b', marginTop: 4 }}>{cust.phone}</Text>}
          {cust.email && <Text style={{ color: '#64748b', marginTop: 4 }}>{cust.email}</Text>}
          {cust.address && <Text style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>{cust.address}</Text>}
        </View>

       {/* Three Dots Button - Now opens small dropdown */}
<TouchableOpacity
  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
  onPress={(e) => {
    e.stopPropagation();
    
    // Measure position of the button
    e.nativeEvent.pageY; // We use the event to get approximate position
    const approximateY = e.nativeEvent.pageY;
    
    setContextMenuPosition({ y: approximateY - 100 }); // Adjust offset as needed
    setContextMenuCustomer(cust);
    setContextMenuIndex(i);
    setShowContextMenu(true);
  }}
  style={{
    padding: 10,
    borderRadius: 16,
    backgroundColor: darkMode ? '#374151' : '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  }}
  activeOpacity={0.7}
>
  <Ionicons name="ellipsis-vertical" size={20} color={darkMode ? '#e5e7eb' : '#64748b'} />
</TouchableOpacity>
      </View>
    </TouchableOpacity>
  ))}
        {customerDatabase.length === 0 && (
          <Text style={{ textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', padding: 40 }}>
            No saved customers yet
          </Text>
        )}
      </ScrollView>
    </View>
  </View>
</Modal>

{/* SMALL & TRANSPARENT CONTEXT MENU */}
<Modal
  visible={showContextMenu}
  transparent
  animationType="fade"
  onRequestClose={() => setShowContextMenu(false)}
>
  {/* Backdrop - subtle blur effect */}
  <TouchableOpacity
    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
    activeOpacity={1}
    onPress={() => setShowContextMenu(false)}
  />

  {/* Compact Dropdown */}
  <View style={{
    position: 'absolute',
    top: contextMenuPosition.y || '50%',
    right: 24, // closer to the edge
    backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)', // semi-transparent
    backdropFilter: 'blur(10px)', // subtle blur (works on iOS/Android with expo)
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
    borderWidth: 1,
    borderColor: darkMode ? '#374151' : '#e2e8f0',
    minWidth: 160,
  }}>
    {/* Edit */}
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        gap: 10,
      }}
      onPress={() => {
        setShowContextMenu(false);
        setEditingCustomerIndex(contextMenuIndex);
        setTempCustomer({ ...contextMenuCustomer });
        setShowAddCustomerForm(true);
      }}
      activeOpacity={0.7}
    >
      <Ionicons name="create-outline" size={18} color="#10b981" />
      <Text style={{
        fontSize: 15,
        fontWeight: '600',
        color: darkMode ? '#e5e7eb' : '#1f2937',
      }}>
        Edit
      </Text>
    </TouchableOpacity>

    {/* Delete */}
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        gap: 10,
      }}
      onPress={() => {
        setShowContextMenu(false);
        showConfirm({
          title: "Delete Customer?",
          message: `${contextMenuCustomer?.name}\nThis cannot be undone.`,
          confirmText: "Delete Forever",
          destructive: true,
          onConfirm: () => {
            const updated = customerDatabase.filter((_, idx) => idx !== contextMenuIndex);
            saveCustomerDatabase(updated);
            Toast.show({ type: 'skull', text1: 'Customer deleted' });
          },
        });
      }}
      activeOpacity={0.7}
    >
      <Ionicons name="skull-outline" size={18} color="#dc2626" />
      <Text style={{
        fontSize: 15,
        fontWeight: '600',
        color: '#dc2626',
      }}>
        Delete
      </Text>
    </TouchableOpacity>
  </View>
</Modal>


{/* CUSTOMER ACTION SHEET - BEAUTIFUL VERSION */}
<Modal visible={showCustomerActionSheet} transparent animationType="slide">
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
    {/* Backdrop tap to close */}
    <TouchableOpacity
      style={{ flex: 1 }}
      activeOpacity={1}
      onPress={() => setShowCustomerActionSheet(false)}
    />

    {/* Bottom Sheet */}
    <View style={{
      backgroundColor: darkMode ? '#111827' : '#ffffff',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 28,
      paddingTop: 20,
      paddingBottom: 40,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 30,
    }}>
      {/* Drag handle */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={{
          width: 50,
          height: 6,
          backgroundColor: darkMode ? '#374151' : '#cbd5e1',
          borderRadius: 3,
        }} />
      </View>

      {/* Customer Name - Prominent */}
      <Text style={{
        fontSize: 28,
        fontWeight: '900',
        color: '#10b981',
        textAlign: 'center',
        marginBottom: 8,
      }}>
        {selectedCustomerForAction?.name || 'Customer'}
      </Text>

      {/* Subtitle */}
      <Text style={{
        fontSize: 17,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 36,
        fontWeight: '500',
      }}>
        Manage this customer
      </Text>

      {/* EDIT BUTTON - Elevated & Spacious */}
      <TouchableOpacity
        style={{
          backgroundColor: '#10b981',
          paddingVertical: 20,
          paddingHorizontal: 24,
          borderRadius: 24,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          marginBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 12,
        }}
        onPress={() => {
          setShowCustomerActionSheet(false);
          setEditingCustomerIndex(selectedCustomerIndex);
          setTempCustomer({ ...selectedCustomerForAction });
          setShowAddCustomerForm(true);
          setShowCustomerMenu(false);
        }}
        activeOpacity={0.9}
      >
        <Ionicons name="create-outline" size={30} color="white" />
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 19 }}>
          Edit Customer
        </Text>
      </TouchableOpacity>

      {/* DELETE BUTTON - Destructive but elegant */}
      <TouchableOpacity
        style={{
          backgroundColor: '#dc2626',
          paddingVertical: 20,
          paddingHorizontal: 24,
          borderRadius: 24,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 12,
        }}
        onPress={() => {
          setShowCustomerActionSheet(false);
          showConfirm({
            title: "Delete Customer?",
            message: `${selectedCustomerForAction?.name}\nThis cannot be undone.`,
            confirmText: "Delete Forever",
            destructive: true,
            onConfirm: () => {
              const updated = customerDatabase.filter((_, idx) => idx !== selectedCustomerIndex);
              saveCustomerDatabase(updated);
              Toast.show({ type: 'skull', text1: 'Customer deleted' });
            },
          });
        }}
        activeOpacity={0.9}
      >
        <Ionicons name="skull-outline" size={30} color="white" />
        <Text style={{ color: 'white', fontWeight: '900', fontSize: 19 }}>
          Delete Customer
        </Text>
      </TouchableOpacity>

      {/* CANCEL - Subtle but clear */}
      <TouchableOpacity
        style={{
          marginTop: 32,
          paddingVertical: 16,
        }}
        onPress={() => setShowCustomerActionSheet(false)}
      >
        <Text style={{
          color: '#64748b',
          fontWeight: '700',
          fontSize: 18,
          textAlign: 'center',
        }}>
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

{/* PHONE CONTACTS PICKER MODAL */}
<Modal visible={showPhoneContactsPicker} transparent animationType="slide">
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPhoneContactsPicker(false)} />

    <View style={{
      backgroundColor: darkMode ? '#111827' : '#ffffff',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      maxHeight: '85%',
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#10b981' }}>
          Phone Contacts ({phoneContacts.length})
        </Text>
        <TouchableOpacity onPress={() => setShowPhoneContactsPicker(false)}>
          <Icon name="close" size={34} color={darkMode ? 'white' : '#1f2937'} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TextInput
        placeholder="Search contacts..."
        value={phoneContactSearch}
        placeholderTextColor={placeholderColor}
        onChangeText={setPhoneContactSearch}
        style={[
          styles.input,
          darkMode && styles.inputDark,
          { marginBottom: 16 }
        ]}
      />

      {/* Contacts List */}
      <FlatList
        data={phoneContacts.filter(c =>
          c.name?.toLowerCase().includes(phoneContactSearch.toLowerCase()) ||
          c.phoneNumbers?.some(p => p.number?.includes(phoneContactSearch)) ||
          c.emails?.some(e => e.email?.toLowerCase().includes(phoneContactSearch.toLowerCase()))
        )}
        keyExtractor={item => item.id}
        renderItem={({ item: contact }) => (
          <TouchableOpacity
            style={{
              padding: 18,
              backgroundColor: darkMode ? '#1f2937' : '#f8fafc',
              borderRadius: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: darkMode ? '#374151' : '#e2e8f0',
            }}
           onPress={() => {
  const newCust = {
    name: contact.name || '',
    phone: contact.phoneNumbers?.[0]?.number || '',
    email: contact.emails?.[0]?.email || '',
    address: '', // Phone contacts don't reliably provide full address
  };

  // Prevent duplicate (by name + phone)
  const isDuplicate = customerDatabase.some(c => 
    c.name === newCust.name && 
    (!newCust.phone || c.phone === newCust.phone)
  );

  if (!isDuplicate) {
    const updated = [...customerDatabase, newCust];
    saveCustomerDatabase(updated);
    Toast.show({
      type: 'success',
      text1: 'Added to Database!',
      text2: newCust.name,
    });
  }

  setCustomer(newCust);
  setShowPhoneContactsPicker(false);
  showMsg(`Selected: ${contact.name}`);
}}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: darkMode ? '#e5e7eb' : '#1f2937' }}>
              {contact.name || 'No Name'}
            </Text>
            {contact.phoneNumbers?.[0] && (
              <Text style={{ color: '#64748b', marginTop: 4 }}>
                {contact.phoneNumbers[0].number}
              </Text>
            )}
            {contact.emails?.[0] && (
              <Text style={{ color: '#64748b', marginTop: 4 }}>
                {contact.emails[0].email}
              </Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', padding: 40 }}>
            No contacts match your search
          </Text>
        }
      />
    </View>
  </View>
</Modal>

{/* ADD / EDIT CUSTOMER FORM */}
<Modal visible={showAddCustomerForm} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={[styles.modalBox, darkMode && styles.modalBoxDark]}>
      <Text style={styles.modalTitle}>
        {editingCustomerIndex === -1 ? 'Add New Client' : 'Edit Client'}
      </Text>

      <TextInput
        placeholder="Name *"
        value={tempCustomer.name}
        onChangeText={t => setTempCustomer(c => ({...c, name: t}))}
        placeholderTextColor={placeholderColor}
        style={[styles.modalInput, darkMode && styles.modalInputDark]}
      />

      <TextInput
        placeholder="Phone"
        value={tempCustomer.phone}
        onChangeText={t => setTempCustomer(c => ({...c, phone: formatPhoneNumber(t)}))}
        keyboardType="phone-pad"
        placeholderTextColor={placeholderColor}
        style={[styles.modalInput, darkMode && styles.modalInputDark]}
      />

      <TextInput
        placeholder="Email"
        value={tempCustomer.email}
        onChangeText={t => setTempCustomer(c => ({...c, email: t}))}
        keyboardType="email-address"
        placeholderTextColor={placeholderColor}
        style={[styles.modalInput, darkMode && styles.modalInputDark]}
      />

      <TextInput
        placeholder="Address (optional)"
        value={tempCustomer.address}
        onChangeText={t => setTempCustomer(c => ({...c, address: t}))}
        multiline
        placeholderTextColor={placeholderColor}
        style={[styles.modalInput, darkMode && styles.modalInputDark, { height: 80 }]}
      />

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#6b7280', padding: 16, borderRadius: 12, alignItems: 'center' }}
          onPress={() => {
            setShowAddCustomerForm(false);
            setTempCustomer({ name: '', phone: '', email: '', address: '' });
            setEditingCustomerIndex(-1);
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flex: 1, backgroundColor: '#10b981', padding: 16, borderRadius: 12, alignItems: 'center' }}
         onPress={() => {
  if (!tempCustomer.name.trim()) {
    showMsg('Name is required');
    return;
  }

  let updated;
  if (editingCustomerIndex === -1) {
    // Adding new customer
    updated = [...customerDatabase, { ...tempCustomer }];
  } else {
    // Editing existing
    updated = [...customerDatabase];
    updated[editingCustomerIndex] = { ...tempCustomer };
  }

  // Save to database
  saveCustomerDatabase(updated);

  // === AUTO-SELECT THE CUSTOMER FOR CURRENT ESTIMATE ===
  setCustomer(tempCustomer);  // ← This line makes it auto-selected

  // Reset and close
  setShowAddCustomerForm(false);
  setEditingCustomerIndex(-1);
  setTempCustomer({ name: '', phone: '', email: '', address: '' });

  showMsg(
    editingCustomerIndex === -1 
      ? 'Client added & selected!' 
      : 'Client updated'
  );
}}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
            {editingCustomerIndex === -1 ? 'Save Client' : 'Update Client'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

{/* TOAST MODAL — PLAIN & TOOL-LIKE */}
<Modal transparent visible={!!quickToast} animationType="fade">
  <View style={{
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
    pointerEvents: 'none',
  }}>
    <View style={{
      backgroundColor: darkMode ? '#1f2937' : '#ffffff',
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 8,  // Less rounded — sharp tool feel
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: darkMode ? 0.5 : 0.2,
      shadowRadius: 8,
      elevation: 16,
      borderWidth: 2,
      borderColor: '#86efac',  // Your light green border only
      maxWidth: '85%',
    }}>
      <Text style={{
        color: darkMode ? '#e5e7eb' : '#1f2937',
        fontWeight: '600',
        fontSize: 16,
        textAlign: 'center',
      }}>
        {quickToast}
      </Text>
    </View>
  </View>
</Modal>

{/* SLIDING ITEM PANEL — THIS IS THE MAGIC */}
{currentJob && (
  <Modal
    visible={!!currentJob}
    transparent={true}
    animationType="fade"
    onRequestClose={() => setCurrentJob('')} // ← Important for Android back button
    statusBarTranslucent={true}
  >
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', flexDirection: 'row' }}>
      {/* Tap outside to close */}
      <TouchableOpacity 
        style={{ flex: 1 }} 
        activeOpacity={1} 
        onPress={() => setCurrentJob('')}
      />

      {/* Sliding Panel */}
      <View style={{
        width: '88%',
        backgroundColor: darkMode ? '#111' : '#fff',
        shadowColor: '#000',
        shadowOffset: { width: -10, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 20,
        borderTopLeftRadius: 24,
        borderBottomLeftRadius: 24,
      }}>
        {/* Header */}
        <View style={{
          paddingTop: 60,
          paddingHorizontal: 24,
          paddingBottom: 20,
          backgroundColor: '#10b981',
          borderTopLeftRadius: 24,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: 'white' }}>
            {currentJob}
          </Text>
          <TouchableOpacity 
        onPress={() => setCurrentJob('')}
      >
            <Icon name="close" size={36} color="white" />
          </TouchableOpacity>
        </View>
        
        {/* ADD ITEM BUTTONS — TWO BUTTONS SIDE BY SIDE */}
<View style={{ padding: 16, flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
  {/* 1. Custom Add Item (your existing one) */}
  <TouchableOpacity
    style={{
      flex: 1,
      backgroundColor: '#10b981',
      padding: 16,
      borderRadius: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
    }}
    onPress={() => setShowAddDefaultItem(true)}
  >
    <Icon name="add-circle" size={26} color="white" />
    <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>Add Item</Text>
  </TouchableOpacity>

  {/* 2. NEW: Add from Database */}
  <TouchableOpacity
  style={{
    flex: 1,
    backgroundColor: darkMode ? '#4b5563' : '#6366f1',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  }}
  onPress={() => {
    setGlobalItemSearch('');
    setSelectedDatabaseItems({});
    setShowItemDatabasePicker(true);  // ← Just open the modal
  }}
>
  <Icon name="search" size={26} color="white" />
  <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>Database</Text>
</TouchableOpacity>
</View>
        
        
{/* ITEM LIST + DELETE BAR — FINAL, BULLETPROOF VERSION */}
{/* ITEM LIST + DELETE BUTTON — FINAL PERFECT VERSION */}
<ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
  {(itemsByJob[currentJob] || []).length === 0 ? (
    <View style={{ alignItems: 'center', marginTop: 100 }}>
      <Text style={{ fontSize: 18, color: '#94a3b8', fontStyle: 'italic' }}>
        No items yet — tap a button above
      </Text>
    </View>
  ) : (
    itemsByJob[currentJob].map((item, idx) => {
      const key = `${currentJob}-${idx}`;
      const isSelected = !!selectedItems[key];

      const handlePress = () => {
        // If ANY item is selected → we're in multi-select mode
        if (Object.keys(selectedItems).length > 0) {
          // Toggle selection
          setSelectedItems(prev => {
            const newSel = { ...prev };
            if (newSel[key]) {
              delete newSel[key];
            } else {
              newSel[key] = true;
            }
            return newSel;
          });
        } else {
          // No items selected → normal mode → edit item
          setEditItemJob(currentJob);
          setEditItemIdx(idx);
          setEditItemName(item.name);
          setEditItemQty(String(item.qty));
          setEditItemPrice(String(item.price));
          setShowEditItem(true);
        }
      };

      const handleLongPress = () => {
        if (Object.keys(selectedItems).length === 0) {
          showMsg('Select items to delete');
        }
        setSelectedItems(prev => ({ ...prev, [key]: true }));
      };

      const updateQty = (delta) => {
        const newQty = item.qty + delta;
        if (newQty < 1) return;
        setItemsByJob(prev => ({
          ...prev,
          [currentJob]: prev[currentJob].map((i, iIdx) =>
            iIdx === idx ? { ...i, qty: newQty } : i
          )
        }));
      };

      return (
        <TouchableOpacity
          key={idx}
          activeOpacity={0.75}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={300}
          style={[
            styles.item,
            darkMode && styles.itemDark,
            isSelected && {
              backgroundColor: darkMode ? '#451a03' : '#fef3c7',
              borderWidth: 3,
              borderColor: '#f59e0b',
            },
          ]}
        >
          {/* Orange checkmark */}
          {isSelected && (
            <View style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#f59e0b',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10,
            }}>
              <Icon name="check" size={18} color="white" />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={[
              styles.itemText,
              darkMode && styles.itemTextDark,
              isSelected && { fontWeight: '900', color: darkMode ? '#fcd34d' : '#92400e' }
            ]}>
              {item.name} @ ${item.price.toFixed(2)}
            </Text>
            <Text style={{ color: darkMode ? '#94a3b8' : '#64748b', marginTop: 4 }}>
              Total: ${(item.qty * item.price).toFixed(2)}
            </Text>
          </View>

          {/* Qty controls — only when NOT selected */}
          {!isSelected && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => updateQty(-1)} style={[styles.stepperBtnTiny, darkMode && styles.stepperBtnTinyDark]}>
                <Icon name="remove" size={18} color={darkMode ? "#fff" : "#1f2937"} />
              </TouchableOpacity>
              <Text style={{ fontWeight: '800', minWidth: 36, textAlign: 'center', fontSize: 18, color: darkMode ? '#e5e7eb' : '#1f2937' }}>
                {item.qty}
              </Text>
              <TouchableOpacity onPress={() => updateQty(1)} style={[styles.stepperBtnTiny, darkMode && styles.stepperBtnTinyDark]}>
                <Icon name="add" size={18} color={darkMode ? "#fff" : "#1f2937"} />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      );
    })
  )}
  <View style={{ height: 140 }} />
</ScrollView>

{/* RED DELETE BUTTON — SHOWS COUNT INSIDE, DISAPPEARS INSTANTLY */}
{Object.keys(selectedItems).length > 0 && (
  <View style={{
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: darkMode ? '#111827' : '#ffffff',
    borderTopWidth: 1,
    borderTopColor: darkMode ? '#374151' : '#e2e8f0',
  }}>
    <TouchableOpacity
      style={{
        backgroundColor: '#dc2626',
        padding: 20,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 20,
      }}
      onPress={() => {
        showConfirm({
          title: "Delete Selected Items?",
          message: "This action cannot be undone.",
          confirmText: "Delete Forever",
          destructive: true,
          onConfirm: () => {
            deleteSelectedItems(currentJob);
            setSelectedItems({}); // ← instantly exits multi-select + hides button
            Toast.show({ type: 'skull', text1: 'Items deleted' });
          },
        });
      }}
    >
      <Ionicons name="skull-outline" size={28} color="white" />
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 19 }}>
        Delete Selected ({Object.keys(selectedItems).length})
      </Text>
    </TouchableOpacity>
  </View>
)}

      </View>
    </View>
  </Modal>
)}



{/* CUSTOM MINI-TOAST — ALWAYS ON TOP */}
{quickMessage && (
  <View style={{
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    zIndex: 999999,
    alignItems: 'center',
    pointerEvents: 'none', // doesn't block taps
  }}>
    <Animated.View
      style={{
        backgroundColor: darkMode ? '#166534' : '#10b981',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 20,
        borderWidth: 2,
        borderColor: darkMode ? '#22c55e' : '#86efac',
        opacity: toastAnim,
        transform: [{ scale: toastAnim }],
      }}
    >
      <Text style={{
        color: 'white',
        fontWeight: '800',
        fontSize: 17,
        textAlign: 'center',
      }}>
        {quickMessage.text}
      </Text>
    </Animated.View>
  </View>
)}



        {/* PORTAL THE TOAST — after KeyboardAvoidingView but still inside SafeAreaView */}
        <Portal>
          <Toast
            config={toastConfig}
            position="bottom"
            bottomOffset={100}
            visibilityTime={2200}
          />
          
        </Portal>
      
      </SafeAreaView>
    </Host>
  </GestureHandlerRootView>
);
}

/* STYLES */
const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#f8fafc' },
  darkBg: { backgroundColor: '#111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 10 },
  section: { marginBottom: 24 },
  title: { color: '#10b981', fontSize: 18, fontWeight: 'bold', marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  textDark: { color: '#e5e7eb' },
 input: { 
  backgroundColor: 'white', 
  color: '#1f2937', 
  padding: 15, 
  borderRadius: 8, 
  marginBottom: 10, 
  fontSize: 16, 
  borderWidth: 1, 
  borderColor: '#e2e8f0' 
},

inputDark: { 
  backgroundColor: '#222', 
  color: '#ffffff', 
  borderColor: '#444',  
},

placeholderTextLight: {               // ← NEW
  color: '#6b7280',                   // gray that shows up on white
},
placeholderTextDark: {                // ← NEW  
  color: '#9ca3af',                   // gray that shows up on dark
},
modalInputDark: { backgroundColor: '#374151', color: '#ffffff' },
totalLabelDark: { color: '#e5e7eb' },
totalValueDark: { color: '#ffffff', fontWeight: 'bold' },
grandDark: { color: '#34d399' },  // brighter green
totalsDark: { backgroundColor: '#1f2937', borderColor: '#374151' },
  btn: { backgroundColor: '#e2e8f0', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnDark: { backgroundColor: '#333' },
  btnText: { color: '#10b981', fontWeight: 'bold' },
  jobBtn: { padding: 10, borderRadius: 8, borderWidth: 2 },
  jobDark: { backgroundColor: '#222', borderColor: '#444' },
  jobActive: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  jobActiveDark: { backgroundColor: '#facc15', borderColor: '#f59e0b' },
  jobText: { color: '#64748b' },
  jobTextDark: { color: '#e5e7eb' },
  jobTextActive: { color: '#92400e', fontWeight: 'bold' },
  jobTextActiveDark: { color: '#1f2937', fontWeight: 'bold' },
  addBtnDark: { 
  backgroundColor: '#1f2937'   // ← dark gray, matches your other dark buttons
},
  itemActive: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  itemActiveDark: { backgroundColor: '#facc15', borderColor: '#f59e0b' },
  itemText: { color: '#1f2937' },
  itemTextDark: { color: '#e5e7eb' },
  itemTextActiveDark: { color: '#1f2937', fontWeight: 'bold' },
  addBtn: { backgroundColor: '#e2e8f0', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 8 },
  addText: { color: '#10b981', fontWeight: 'bold' },
  deleteBtn: { backgroundColor: '#fee2e2', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 8 },
  deleteText: { color: '#dc2626', fontWeight: 'bold' },
  editBtn: { backgroundColor: '#e2e8f0', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  editText: { color: '#10b981', fontWeight: 'bold' },
  laborBox: { marginTop: 10, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8 },
  laborLine: { color: '#64748b', fontSize: 14, marginBottom: 4 },
  laborTotal: { color: '#10b981', fontWeight: 'bold', fontSize: 16, marginTop: 6 },
  totals: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginVertical: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  cardDark: { backgroundColor: '#222', borderColor: '#444' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
 
  actions: { flexDirection: 'row', gap: 12, marginVertical: 20 },
  sendBtn: { backgroundColor: '#10b981', padding: 16, borderRadius: 12, flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  sendBtnText: { color: '#fff', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#6366f1', padding: 16, borderRadius: 12, flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  clearBtn: { backgroundColor: '#dc2626', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  clearBtnText: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#ffffff', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
  modalBoxDark: { backgroundColor: '#1f2937' },
  modalTitle: { color: '#10b981', fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: '#f1f5f9', color: '#1f2937', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 16 },
  
  modalActions: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  modalCancel: { backgroundColor: '#6b7280', padding: 14, borderRadius: 12, flex: 1, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  modalOK: { backgroundColor: '#10b981', padding: 14, borderRadius: 12, flex: 1, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  modalDelete: { backgroundColor: '#dc2626', padding: 14, borderRadius: 12, flex: 1, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  modalCloseBtn: { marginTop: 24, padding: 12 },
  modalCloseText: { color: '#10b981', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  modalCloseTextLight: {                // ← NEW
  color: '#dc2626', 
  fontWeight: 'bold', 
  fontSize: 16, 
  textAlign: 'center'
},
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  dropdownItemSelected: {
  backgroundColor: '#f0fdf4',   // very soft green
  borderRadius: 8,
  paddingLeft: 12,
  marginVertical: 2,
  borderLeftWidth: 4,
  borderLeftColor: '#22c55e',                         // tailwind‑green‑500
},
  successBox: { backgroundColor: '#fff', padding: 32, borderRadius: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 12, maxWidth: 300 },
  successBoxDark: { backgroundColor: '#1f2937' },
  successTitle: { color: '#10b981', fontSize: 22, fontWeight: 'bold', marginTop: 12 },
  successMsg: { color: '#4b5563', fontSize: 16, textAlign: 'center', marginTop: 8 },
  emptyText: { color: '#9ca3af', fontStyle: 'italic', marginTop: 8 },
  smallBtn: { padding: 8, borderRadius: 8, backgroundColor: '#e2e8f0' },
  label: { color: '#10b981', fontWeight: 'bold', marginTop: 12, marginBottom: 4 },
  headerLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  
  notesInput: {
  height: 120,           // makes it tall enough for real notes
  paddingTop: 14,
},

jobCard: {
  backgroundColor: 'white',
  padding: 16,
  borderRadius: 16,
  minWidth: 140,
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 5,
  borderWidth: 1,
  borderColor: '#e2e8f0',
},
jobCardDark: {
  backgroundColor: '#1f2937',
  borderColor: '#374151',
},
jobCardTitle: {
  fontWeight: 'bold',
  fontSize: 16,
  color: '#1f2937',
},
slidingPanel: {
  backgroundColor: 'white',
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  flex: 1,                  
  maxHeight: window.height * 0.85,
},
slidingPanelDark: {
  backgroundColor: '#111',
},
slidingPanelHeader: {
  backgroundColor: '#10b981',
  padding: 20,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
slidingPanelTitle: {
  fontSize: 24,
  fontWeight: 'bold',
  color: 'white',
},
panelAddBtn: {
  flex: 1,
  backgroundColor: '#10b981',
  padding: 16,
  borderRadius: 16,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 10,
},
panelAddText: {
  color: 'white',
  fontWeight: '700',
  fontSize: 16,
},
slidingItem: {
  padding: 16,
  backgroundColor: '#f8fafc',
  marginHorizontal: 16,
  marginVertical: 6,
  borderRadius: 12,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
slidingItemDark: {
  backgroundColor: '#1f2937',
},
slidingItemName: {
  fontWeight: '600',
  fontSize: 16,
},
  
  btnFlex: {
  flex: 1,
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
},
  
  dbEmpty: {
    padding: 16,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  logoOption: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 20,
  backgroundColor: '#f8fafc',
  borderRadius: 12,
  marginBottom: 12,
  gap: 16,
  borderWidth: 1,
  borderColor: '#e2e8f0',
},
logoOptionDark: {
  backgroundColor: '#374151',
  borderColor: '#4b5563',
},
logoOptionText: {
  fontSize: 16,
  color: '#1f2937',
  fontWeight: '600',
  flex: 1,
},
helpBubble: {
  position: 'absolute',
  backgroundColor: '#ffffff',
  paddingHorizontal: 18,
  paddingVertical: 14,
  borderRadius: 20,
  maxWidth: 300,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.5,
  shadowRadius: 16,
  elevation: 20,
  borderWidth: 4,
  borderColor: '#10b981',
},
helpBubbleDark: {
  backgroundColor: '#1f2937',
  borderColor: '#34d399',
},
helpBubbleText: {
  color: '#ffffff',
  fontWeight: '800',
  fontSize: 16,
  textAlign: 'center',
},
helpBubbleArrow: {
  position: 'absolute',
  bottom: -18,
  left: '50%',
  marginLeft: -18,
  width: 0,
  height: 0,
  borderLeftWidth: 18,
  borderRightWidth: 18,
  borderTopWidth: 18,
  borderLeftColor: 'transparent',
  borderRightColor: 'transparent',
},

logoOptionRemove: {
  backgroundColor: '#fee2e2',
  borderColor: '#fecaca',
},
logoOptionRemoveText: {
  fontSize: 16,
  color: '#dc2626',
  fontWeight: '600',
  flex: 1,
},
item: {
  padding: 12,
  borderRadius: 12,
  marginBottom: 8,
  backgroundColor: 'white',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
itemDark: {
  backgroundColor: '#1e293b',
},

stepperBtnTiny: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: '#e2e8f0',
  justifyContent: 'center',
  alignItems: 'center',
},
stepperBtnTinyDark: {
  backgroundColor: '#374151',
},

inputLabel: { 
  color: '#374151',           // Dark gray (light mode)
  fontWeight: '600', 
  fontSize: 15,
  marginBottom: 6
},
inputLabelDark: { 
  color: '#e5e7eb',           // Light gray (dark mode)
  fontWeight: '600', 
  fontSize: 15,
  marginBottom: 6
},
helpBubble: {
  position: 'absolute',
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 20,
  maxWidth: 300,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.5,
  shadowRadius: 16,
  elevation: 20,
},
helpBubbleLight: { backgroundColor: '#ffffff', borderWidth: 4, borderColor: '#10b981' },
helpBubbleDark: { backgroundColor: '#1f2937', borderWidth: 4, borderColor: '#34d399' },
helpBubbleText: { color: '#ffffff', fontWeight: '800', fontSize: 16, textAlign: 'center' },
helpBubbleArrow: {
  position: 'absolute',
  bottom: -16,
  left: '50%',
  marginLeft: -16,
  width: 0,
  height: 0,
  borderLeftWidth: 16,
  borderRightWidth: 16,
  borderTopWidth: 16,
  borderLeftColor: 'transparent',
  borderRightColor: 'transparent',
},

helpLabelLight: {
  position: 'absolute',
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  color: '#1f2937',
  fontSize: 13.5,
  fontWeight: '600',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 12,
  maxWidth: '78%',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 8,
  elevation: 8,
  borderWidth: 1,
  borderColor: '#e2e8f0',
},
simpleModal: {
  backgroundColor: '#ffffff',
  marginHorizontal: 16,
  marginVertical: 50,
  borderRadius: 20,
  padding: 24,
  maxHeight: '90%',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.15,
  shadowRadius: 30,
  elevation: 20,
},
simpleModalDark: { backgroundColor: '#111827' },
simpleHeader: { 
  flexDirection: 'row', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  marginBottom: 20 
},
simpleTitle: { 
  fontSize: 26, 
  fontWeight: '800', 
  color: '#10b981' 
},
simpleAddBtn: { 
  flexDirection: 'row', 
  alignItems: 'center', 
  padding: 16, 
  backgroundColor: '#f0fdf4', 
  borderRadius: 14, 
  borderWidth: 1.5, 
  borderColor: '#10b981',
  marginBottom: 20
},
simpleAddText: { 
  marginLeft: 10, 
  fontSize: 17, 
  fontWeight: '600', 
  color: '#10b981' 
},
simpleRow: { 
  padding: 18, 
  backgroundColor: '#f8fafc', 
  borderRadius: 14, 
  marginBottom: 12,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderWidth: 1,
  borderColor: '#e2e8f0'
},
simpleRowDark: { 
  backgroundColor: '#1f2937', 
  borderColor: '#374151' 
},
simpleJobName: { 
  fontSize: 18, 
  fontWeight: '700', 
  color: '#1f2937' 
},
simpleJobInfo: { 
  fontSize: 14, 
  color: '#64748b', 
  marginTop: 4 
},
simpleActionBtn: { 
  paddingHorizontal: 16, 
  paddingVertical: 10, 
  borderRadius: 10 
},
simpleUseBtn: { backgroundColor: '#10b981' },
simpleRemoveBtn: { backgroundColor: '#dc2626' },
simpleUseText: { color: 'white', fontWeight: '600' },
simpleRemoveText: { color: 'white', fontWeight: '600' },
simpleSecondaryBtn: { 
  paddingHorizontal: 16, 
  paddingVertical: 10, 
  backgroundColor: '#e0e7ff', 
  borderRadius: 10 
},
simpleSecondaryText: { 
  color: '#6366f1', 
  fontWeight: '600' 
},
simpleDeleteBtn: { 
  paddingHorizontal: 16, 
  paddingVertical: 10, 
  backgroundColor: '#fee2e2', 
  borderRadius: 10 
},
simpleDeleteText: { 
  color: '#dc2626', 
  fontWeight: '600' 
},

jobCardFixed: {
  backgroundColor: '#ffffff',
  paddingHorizontal: 24,
  paddingVertical: 20,
  borderRadius: 20,
  minWidth: 160,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.15,
  shadowRadius: 12,
  elevation: 12,
  borderWidth: 2,
  overflow: 'hidden',   // ← THIS IS THE MAGIC
  borderColor: '#10b981',
},
jobCardFixedDark: {
  backgroundColor: '#1f2937',
  borderColor: '#16a34a',
  shadowOpacity: 0.4,
},
jobCardFixedTitle: {
  fontSize: 20,
  fontWeight: '800',
  color: '#10b981',
  textAlign: 'center',
  marginBottom: 6,
},
jobCardFixedCount: {
  fontSize: 15,
  color: '#64748b',
  fontWeight: '600',
},
selectedJobTile: {
  backgroundColor: '#ffffff',
  paddingHorizontal: 28,
  paddingVertical: 24,
  borderRadius: 20,
  minWidth: 170,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 12,
  elevation: 14,
  borderWidth: 3,
  overflow: 'hidden',   // ← THIS IS THE MAGIC
  borderColor: '#10b981',
},
selectedJobTileDark: {
  backgroundColor: '#1f2937',
  borderColor: '#16a34a',
},
selectedJobName: {
  fontSize: 22,
  fontWeight: '800',
  color: '#10b981',
  textAlign: 'center',
},
selectedJobCount: {
  fontSize: 15,
  color: '#64748b',
  marginTop: 6,
  fontWeight: '600',
},

jobManagerBox: {
  backgroundColor: '#ffffff',
  marginHorizontal: 20,
  marginTop: 80,
  marginBottom: 60,
  borderRadius: 24,
  padding: 24,
  maxHeight: '85%',
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 20,
  elevation: 20,
},
jobManagerBoxDark: { backgroundColor: '#111827' },
jobManagerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
jobManagerTitle: { fontSize: 28, fontWeight: '800', color: '#10b981' },
jobManagerAdd: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#f0fdf4', borderRadius: 16, borderWidth: 2, borderColor: '#10b981', marginBottom: 16 },
jobManagerAddText: { marginLeft: 12, fontSize: 18, fontWeight: '600', color: '#10b981' },
jobManagerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
jobManagerRowDark: { borderBottomColor: '#374151' },
jobManagerName: { fontSize: 19, fontWeight: '700', color: '#1f2937' },
jobManagerMeta: { fontSize: 15, color: '#64748b', marginTop: 4 },
helpLabelDark: {
  position: 'absolute',
  backgroundColor: 'rgba(31, 41, 55, 0.95)',
  color: '#f3f4f6',
  fontSize: 13.5,
  fontWeight: '600',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 12,
  maxWidth: '78%',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
  elevation: 8,
  borderWidth: 1,
  borderColor: '#374151',
},
helpBubble: {
  position: 'absolute',
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 18,
  maxWidth: 280,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 16,
  alignItems: 'center',
  // Make it slightly transparent
  opacity: 0.66,
},

helpBubbleLight: {
  backgroundColor: 'rgba(255, 255, 255, 0.97)',
  borderWidth: 3,
  borderColor: '#10b981',
},

helpBubbleDark: {
  backgroundColor: 'rgba(31, 41, 55, 0.97)',   // gray-800
  borderWidth: 3,
  borderColor: '#34d399',
},

// Critical: Text color now adapts!
helpBubbleText: {
  fontWeight: '800',
  fontSize: 15,
  textAlign: 'center',
  lineHeight: 20,
  // This is the key fix:
  color: '#1f2937', // dark gray in light mode
},

helpBubbleTextDark: {
  color: '#ffffff', // white in dark mode
},

helpBubbleArrow: {
  position: 'absolute',
  bottom: -16,
  left: '50%',
  marginLeft: -16,
  width: 0,
  height: 0,
  borderLeftWidth: 16,
  borderRightWidth: 16,
  borderTopWidth: 16,
  borderLeftColor: 'transparent',
  borderRightColor: 'transparent',
},
helpBubbleArrowLight: {
  borderTopColor: '#ffffff',
},
helpBubbleArrowDark: {
  borderTopColor: '#1f2937',
},



});


