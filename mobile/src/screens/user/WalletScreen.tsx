import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Wallet, Plus, ArrowUpRight, ArrowDownLeft, Calendar, ShieldCheck } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import API from '../../lib/api';
import { Theme } from '../../theme';

interface WalletScreenProps {
  navigation: any;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [customAmount, setCustomAmount] = useState('');

  const { data: walletData, isLoading: walletLoading, refetch } = useQuery({
    queryKey: ['walletBalance'],
    queryFn: () => API.payment.getWalletBalance(),
  });

  const addFundsMutation = useMutation({
    mutationFn: (amount: number) => API.payment.addWalletFunds(amount),
    onSuccess: async (data: any) => {
      if (data.shortUrl) {
        // Open the Razorpay checkout page in an in-app web browser
        await WebBrowser.openBrowserAsync(data.shortUrl);
        // After browser modal closes, refresh balance
        refetch();
        queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
      } else {
        Alert.alert('Payment Error', 'Failed to retrieve payment link.');
      }
    },
    onError: (err: any) => {
      Alert.alert('Payment Error', err.message || 'Failed to initiate payment');
    },
  });

  const handleAddFunds = (amount: number) => {
    if (amount <= 0 || isNaN(amount)) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    addFundsMutation.mutate(amount);
  };

  const getPurposeLabel = (purpose: string) => {
    switch (purpose) {
      case 'add_funds':
        return 'Loaded Funds';
      case 'unlock_report':
        return 'Unlocked Wellness Report';
      case 'book_therapist':
        return 'Booked Therapist Session';
      default:
        return purpose;
    }
  };

  const balance = walletData?.walletBalance ?? 0;
  const transactions = walletData?.transactions ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header back button */}
      <View style={styles.backRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wallet</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceTitle}>TOTAL BALANCE</Text>
          <View style={styles.secureBadge}>
            <ShieldCheck size={12} color="#FFF" />
            <Text style={styles.secureText}>Secure</Text>
          </View>
        </View>
        {walletLoading ? (
          <ActivityIndicator color="#FFF" style={styles.loader} />
        ) : (
          <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
        )}
      </View>

      {/* Add Funds Panel */}
      <View style={styles.addPanel}>
        <Text style={styles.panelTitle}>Add Funds to Wallet</Text>
        
        {/* Quick Amounts */}
        <View style={styles.quickRow}>
          {[100, 250, 500, 1000].map((amt) => (
            <TouchableOpacity
              key={amt}
              disabled={addFundsMutation.isPending}
              onPress={() => handleAddFunds(amt)}
              style={styles.quickBtn}
            >
              <Text style={styles.quickBtnText}>+ ₹{amt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            placeholder="Enter custom amount"
            placeholderTextColor={Theme.colors.outline}
            keyboardType="numeric"
            value={customAmount}
            onChangeText={setCustomAmount}
            editable={!addFundsMutation.isPending}
            style={styles.textInput}
          />
          <TouchableOpacity
            disabled={addFundsMutation.isPending || !customAmount}
            onPress={() => {
              handleAddFunds(parseFloat(customAmount));
              setCustomAmount('');
            }}
            style={[styles.addBtn, !customAmount && styles.disabledBtn]}
          >
            {addFundsMutation.isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Plus size={16} color="#FFF" />
                <Text style={styles.addBtnText}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Transaction History */}
      <View style={styles.txContainer}>
        <Text style={styles.txHeader}>Transaction History</Text>

        {walletLoading ? (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator color={Theme.colors.primary} />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Wallet size={32} color={Theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptyDesc}>Your transactions will appear here once you load or spend funds.</Text>
          </View>
        ) : (
          <View style={styles.txList}>
            {transactions.map((tx: any) => {
              const isCredit = tx.type === 'credit';
              const isSuccess = tx.status === 'success';

              return (
                <View key={tx._id || tx.id} style={styles.txItem}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txIconBox, { backgroundColor: isCredit ? '#E8F5E9' : '#FFEBEE' }]}>
                      {isCredit ? (
                        <ArrowDownLeft size={18} color="#2E7D32" />
                      ) : (
                        <ArrowUpRight size={18} color="#C62828" />
                      )}
                    </View>
                    <View style={styles.txInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.txPurpose}>{getPurposeLabel(tx.purpose)}</Text>
                        <View style={[
                          styles.statusBadge, 
                          { 
                            backgroundColor: isSuccess ? '#E8F5E9' : tx.status === 'pending' ? '#FFF8E1' : '#FFEBEE' 
                          }
                        ]}>
                          <Text style={[
                            styles.statusText,
                            { 
                              color: isSuccess ? '#2E7D32' : tx.status === 'pending' ? '#F57F17' : '#C62828'
                            }
                          ]}>
                            {tx.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.txDate}>
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.txAmount, { color: isCredit ? '#2E7D32' : '#C62828' }]}>
                    {isCredit ? '+' : '-'} ₹{tx.amount.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: Theme.spacing.margin,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    gap: Theme.spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  headerTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  balanceCard: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    gap: 8,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceTitle: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.full,
    gap: 4,
  },
  secureText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: '#FFF',
  },
  balanceAmount: {
    fontFamily: Theme.fonts.display,
    fontSize: 36,
    color: '#FFF',
    fontWeight: 'bold',
  },
  loader: {
    alignSelf: 'flex-start',
    marginVertical: 10,
  },
  addPanel: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: Theme.spacing.sm,
  },
  panelTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    height: 38,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    backgroundColor: Theme.colors.surfaceLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.surfaceLow,
    paddingHorizontal: 12,
    height: 48,
  },
  currencySymbol: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurfaceVariant,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurface,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: Theme.radius.md,
    gap: 4,
  },
  disabledBtn: {
    backgroundColor: Theme.colors.outlineVariant,
  },
  addBtnText: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
  },
  txContainer: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: Theme.spacing.md,
  },
  txHeader: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  emptyDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  txList: {
    gap: 12,
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceLow,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    flex: 1,
  },
  txIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txPurpose: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Theme.radius.sm,
  },
  statusText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 8,
  },
  txDate: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  txAmount: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default WalletScreen;
