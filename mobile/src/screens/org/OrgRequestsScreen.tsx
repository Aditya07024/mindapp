import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  UserCheck,
  UserX,
  Clock,
  CheckCircle,
  FileSpreadsheet,
  UserPlus,
  Play,
  RotateCcw,
  Terminal,
  ArrowUpFromLine
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { AppHeader } from '../../components/AppHeader';
import { useSyncStore } from '../../lib/syncStore';

export const OrgRequestsScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; size?: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Bind background sync worker store
  const {
    isSyncing,
    progress,
    currentStep,
    logs,
    fileName: activeFileName,
    matchedCount,
    startSync,
    resetSync
  } = useSyncStore();

  // Subscription check query
  const { data: subData, isLoading: isSubLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => API.subscription.get().catch(() => null),
    retry: false
  });

  const isSubscribed = subData?.subscription?.status === 'active';
  const hasRosterFeature = subData?.config?.enableRosterManagement !== false;

  // Query join requests
  const { data: reqData, isLoading, refetch } = useQuery({
    queryKey: ['org-join-requests'],
    queryFn: () => API.org.joinRequests(),
    retry: false
  });

  const handleJoinAction = async (userId: string, approve: boolean) => {
    setActionLoading(userId);
    try {
      if (approve) {
        await API.org.approveJoinRequest(userId);
        Alert.alert('Approved', 'Employee request approved successfully!');
      } else {
        await API.org.rejectJoinRequest(userId);
        Alert.alert('Rejected', 'Employee request rejected.');
      }
      refetch();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectSpreadsheet = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv'
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      setSelectedFile({
        uri: file.uri,
        name: file.name,
        size: file.size
      });
    } catch (err: any) {
      Alert.alert('Selection Error', err.message || 'Failed to select spreadsheet');
    }
  };

  const handleUploadSpreadsheet = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      // 1. Upload dynamic spreadsheet binary to backend database upload Emails endpoint
      const res = await API.org.uploadEmails(selectedFile.uri, selectedFile.name);
      
      Alert.alert(
        'Roster Synchronized!',
        res.message || `Spreadsheet whitelisted successfully in workspace database!`,
        [{ 
          text: 'Excellent', 
          onPress: () => {
            // Trigger visual background sync console logs using actual filename
            startSync(selectedFile.name, () => {
              refetch();
            });
            setSelectedFile(null);
            refetch();
          } 
        }]
      );
    } catch (err: any) {
      Alert.alert(
        'Upload Failed', 
        err.message || 'Server failed to extract clean email columns from file buffer.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleManualWhitelist = async () => {
    if (!manualEmail.trim() || !manualEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid corporate email address.');
      return;
    }

    try {
      await API.org.invite({ email: manualEmail.trim().toLowerCase() });
      Alert.alert(
        'Email Whitelisted',
        `"${manualEmail.trim().toLowerCase()}" has been manually whitelisted and an invitation was sent.`,
        [{ text: 'Ok', onPress: () => { setManualEmail(''); refetch(); } }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Manual whitelisting failed.');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        userFirstName="BITS Wellness"
        role="org_admin"
        navigation={navigation}
      />

      {isSubLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : !isSubscribed || !hasRosterFeature ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Theme.spacing.margin }}>
          <View style={{
            backgroundColor: '#FFF',
            borderRadius: Theme.radius.xl,
            padding: Theme.spacing.lg,
            borderWidth: 1,
            borderColor: Theme.colors.surfaceHigh,
            alignItems: 'center',
            shadowColor: '#2E6E65',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.03,
            shadowRadius: 10,
            elevation: 2,
          }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: '#FFF2F2',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#FFCDD2',
            }}>
              <ArrowUpFromLine size={24} color={Theme.colors.primary} />
            </View>
            <Text style={{ fontFamily: Theme.fonts.headline, fontSize: 18, color: Theme.colors.onSurface, textAlign: 'center', marginBottom: 8 }}>
              {!isSubscribed ? 'Corporate Plan Required' : 'Roster Management Locked'}
            </Text>
            <Text style={{ fontFamily: Theme.fonts.body, fontSize: 13, color: Theme.colors.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16, marginBottom: 20 }}>
              {!isSubscribed 
                ? 'As an organization or wellness sponsor, you need an active subscription plan to activate employee wellness seats and link network practitioners.'
                : 'Your current subscription plan tier does not include the employee roster management or whitelisting features. Upgrade to invite employees in bulk.'}
            </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('Plans', { role: 'org_admin' })}
              style={{
                backgroundColor: Theme.colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: Theme.radius.lg,
              }}
            >
              <Text style={{ fontFamily: Theme.fonts.bodyBold, fontSize: 13, color: '#FFF' }}>
                {!isSubscribed ? 'View Subscription Plans' : 'Upgrade Plan'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Whitelist control board */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>Corporate Whitelist Manager</Text>
            <Text style={styles.sectionDesc}>
              Synchronize corporate directories to authorize users. Standard registrations matching whitelisted emails bypass admin screening automatically.
            </Text>

            {/* Sync status active view */}
            {(isSyncing || progress > 0) ? (
              <View style={styles.statusPanel}>
                <View style={styles.statusHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.syncStatusTitle}>Background Whitelist Syncing</Text>
                    <Text style={styles.syncStatusFile} numberOfLines={1}>{activeFileName}</Text>
                  </View>
                  <View style={[styles.badge, progress === 100 ? styles.badgeApproved : styles.badgePending]}>
                    <Text style={[styles.badgeText, progress === 100 ? styles.badgeApprovedText : styles.badgePendingText]}>
                      {progress === 100 ? 'COMPLETE' : 'ACTIVE'}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                </View>

                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressText}>{currentStep}</Text>
                  <Text style={styles.percentageText}>{progress}%</Text>
                </View>

                {/* Real-time details counters */}
                <View style={styles.statsSummaryRow}>
                  <View style={styles.statMiniCard}>
                    <Text style={styles.statMiniVal}>{matchedCount}</Text>
                    <Text style={styles.statMiniLabel}>Users Auto-Approved</Text>
                  </View>
                  <View style={styles.statMiniCard}>
                    <Text style={styles.statMiniVal}>{progress >= 75 ? 'Yes' : 'Pending'}</Text>
                    <Text style={styles.statMiniLabel}>Database Sync</Text>
                  </View>
                </View>

                {/* Monospace System Logs terminal */}
                <Text style={styles.terminalLabel}>
                  <Terminal size={12} color={Theme.colors.outline} /> Real-time System Logs
                </Text>
                <View style={styles.terminalContainer}>
                  <ScrollView nestedScrollEnabled style={{ height: 110 }}>
                    {logs.map((log, index) => (
                      <Text key={index} style={styles.terminalText}>
                        {log}
                      </Text>
                    ))}
                    {isSyncing && (
                      <View style={styles.terminalCursorRow}>
                        <ActivityIndicator size="small" color={Theme.colors.primary} style={{ transform: [{ scale: 0.7 }] }} />
                        <Text style={styles.terminalCursor}>Background sync streaming...</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>

                {/* Actions */}
                {progress === 100 && (
                  <TouchableOpacity onPress={resetSync} style={styles.btnReset}>
                    <RotateCcw size={14} color={Theme.colors.primary} />
                    <Text style={styles.btnResetText}>Reset Sync Worker</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.selectorContainer}>
                <Text style={styles.inputLabel}>Select Whitelist Directory Spreadsheet</Text>
                
                {!selectedFile ? (
                  <TouchableOpacity
                    onPress={handleSelectSpreadsheet}
                    style={styles.uploadDropzone}
                  >
                    <ArrowUpFromLine size={28} color={Theme.colors.primary} style={{ marginBottom: 4 }} />
                    <Text style={styles.uploadDropzoneTitle}>Pick Corporate Roster Spreadsheet</Text>
                    <Text style={styles.uploadDropzoneSubtitle}>Supports Excel (.xlsx, .xls) and CSV formulas</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.selectedFileContainer}>
                    <View style={styles.selectedFileHeader}>
                      <FileSpreadsheet size={22} color={Theme.colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectedFileName} numberOfLines={1}>
                          {selectedFile.name}
                        </Text>
                        {selectedFile.size && (
                          <Text style={styles.selectedFileSize}>
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.uploadActionRow}>
                      <TouchableOpacity
                        onPress={handleUploadSpreadsheet}
                        disabled={uploading}
                        style={[styles.btnUpload, uploading && styles.btnDisabled]}
                      >
                        {uploading ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <>
                            <Play size={13} color="#FFF" />
                            <Text style={styles.btnUploadText}>Upload & Sync Roster</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setSelectedFile(null)}
                        disabled={uploading}
                        style={styles.btnClear}
                      >
                        <Text style={styles.btnClearText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={styles.divider} />

            {/* Manual Entry */}
            <Text style={styles.inputLabel}>Add Single Email to Whitelist</Text>
            <View style={styles.inputRow}>
              <TextInput
                placeholder="e.g. employee@company.com"
                placeholderTextColor={Theme.colors.outline}
                value={manualEmail}
                onChangeText={setManualEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
              <TouchableOpacity onPress={handleManualWhitelist} style={styles.btnAdd}>
                <UserPlus size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Requests Logs */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Employee Join Requests</Text>
            <Text style={styles.sectionDesc}>
              Approve or deny employees and students requesting association with your workspace.
            </Text>

            {isLoading ? (
              <ActivityIndicator color={Theme.colors.primary} style={{ marginTop: 24 }} />
            ) : !reqData?.joinRequests || reqData.joinRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Clock size={40} color={Theme.colors.outline} />
                <Text style={styles.emptyText}>No pending join requests.</Text>
              </View>
            ) : (
              reqData.joinRequests.map((req: any) => {
                const status = req.status || 'pending';
                const name = req.fullName || 'mymindtherapyfriend User';
                const emailText = req.email || req.phoneMasked || 'No Contact Info';

                return (
                  <View key={req.userId} style={styles.requestCard}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.employeeName}>{name}</Text>
                        <Text style={styles.employeeEmail}>{emailText}</Text>
                        <Text style={styles.dateLabel}>
                          Requested: {new Date(req.requestedAt || Date.now()).toLocaleDateString()}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          status === 'approved' ? styles.badgeApproved :
                          status === 'rejected' ? styles.badgeRejected : styles.badgePending
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            status === 'approved' ? styles.badgeApprovedText :
                            status === 'rejected' ? styles.badgeRejectedText : styles.badgePendingText
                          ]}
                        >
                          {status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {req.autoApproved && (
                      <View style={styles.autoApprovedBanner}>
                        <CheckCircle size={12} color="#155724" />
                        <Text style={styles.autoApprovedText}>Auto-approved via whitelisted domain</Text>
                      </View>
                    )}

                    {status === 'pending' && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          disabled={actionLoading !== null}
                          onPress={() => handleJoinAction(req.userId, true)}
                          style={[styles.btnApprove, actionLoading === req.userId && styles.btnDisabled]}
                        >
                          {actionLoading === req.userId ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <>
                              <UserCheck size={14} color="#FFF" />
                              <Text style={styles.btnApproveText}>Approve</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={actionLoading !== null}
                          onPress={() => handleJoinAction(req.userId, false)}
                          style={[styles.btnReject, actionLoading === req.userId && styles.btnDisabled]}
                        >
                          <UserX size={14} color="#FF6B6B" />
                          <Text style={styles.btnRejectText}>Deny</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    padding: Theme.spacing.margin,
    paddingBottom: 60,
    gap: Theme.spacing.md,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  section: {
    gap: Theme.spacing.sm,
  },
  sectionHeader: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
  },
  sectionDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
    marginBottom: Theme.spacing.sm,
  },
  selectorContainer: {
    marginTop: Theme.spacing.xs,
    gap: Theme.spacing.sm,
  },
  inputLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.onSurface,
    marginBottom: 4,
  },
  uploadDropzone: {
    height: 110,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Theme.colors.primary,
    borderRadius: Theme.radius.xl,
    backgroundColor: '#E6F4F1',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 4
  },
  uploadDropzoneTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.primary
  },
  uploadDropzoneSubtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.outline
  },
  selectedFileContainer: {
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.xl,
    padding: 12,
    backgroundColor: Theme.colors.surfaceLow,
    gap: 12
  },
  selectedFileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  selectedFileName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface
  },
  selectedFileSize: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.outline,
    marginTop: 2
  },
  uploadActionRow: {
    flexDirection: 'row',
    gap: 8
  },
  btnUpload: {
    flex: 1,
    height: 40,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6
  },
  btnUploadText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: '#FFF'
  },
  btnClear: {
    width: 65,
    height: 40,
    borderWidth: 1,
    borderColor: Theme.colors.outline,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnClearText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.outline
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceLow,
  },
  btnAdd: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.surfaceHigh,
    marginVertical: Theme.spacing.md,
  },
  statusPanel: {
    backgroundColor: '#FAFDFD',
    borderWidth: 1,
    borderColor: '#C3E5DE',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    gap: 8,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  syncStatusTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  syncStatusFile: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.outline,
    marginTop: 1,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  progressText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  percentageText: {
    fontFamily: Theme.fonts.display,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statMiniCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E6F4F1',
    borderRadius: Theme.radius.lg,
    padding: 8,
    alignItems: 'center',
  },
  statMiniVal: {
    fontFamily: Theme.fonts.display,
    fontSize: 16,
    color: Theme.colors.primary,
  },
  statMiniLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 9,
    color: Theme.colors.textMuted,
    marginTop: 1,
  },
  terminalLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.onSurface,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  terminalContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: Theme.radius.lg,
    padding: 8,
  },
  terminalText: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: '#00FF66',
    lineHeight: 14,
  },
  terminalCursorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  terminalCursor: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: '#E0E0E0',
  },
  btnReset: {
    height: 38,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderRadius: Theme.radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  btnResetText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: 8
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.outline
  },
  requestCard: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    shadowColor: '#2E6E65',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: Theme.spacing.sm,
    gap: Theme.spacing.sm
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  employeeName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface
  },
  employeeEmail: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.outline,
    marginTop: 1
  },
  dateLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 4
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  badgeText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10
  },
  badgePending: {
    backgroundColor: '#FFF3CD'
  },
  badgePendingText: {
    color: '#856404'
  },
  badgeApproved: {
    backgroundColor: '#D4EDDA'
  },
  badgeApprovedText: {
    color: '#155724'
  },
  badgeRejected: {
    backgroundColor: '#F8D7DA'
  },
  badgeRejectedText: {
    color: '#721C24'
  },
  autoApprovedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6
  },
  autoApprovedText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: '#155724'
  },
  actionRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceHigh,
    paddingTop: Theme.spacing.sm,
    marginTop: 2
  },
  btnApprove: {
    flex: 2,
    height: 38,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6
  },
  btnApproveText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: '#FFF'
  },
  btnReject: {
    flex: 1,
    height: 38,
    backgroundColor: '#FFF5F5',
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: '#FFE3E3',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6
  },
  btnRejectText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: '#FF6B6B'
  },
  btnDisabled: {
    opacity: 0.7
  }
});

export default OrgRequestsScreen;
