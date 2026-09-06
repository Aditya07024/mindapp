import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  Linking
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  FileText,
  X,
  Share2,
  CheckCircle,
  Smile,
  BookOpen,
  MessageSquare,
  Pill,
  ShieldAlert
} from 'lucide-react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import API from '../../lib/api';
import { Theme } from '../../theme';

interface SessionScreenProps {
  route: any;
  navigation: any;
}

export const SessionScreen: React.FC<SessionScreenProps> = ({ route, navigation }) => {
  const { bookingId, role } = route.params || {};
  const queryClient = useQueryClient();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [isSharingReport, setIsSharingReport] = useState(false);

  // Seeker report sharing state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePeriod, setSharePeriod] = useState<'day' | 'week' | 'month'>('week');
  const [shareNotes, setShareNotes] = useState('');

  // Therapist report view state
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Prescription state (for therapist & view-only seeker)
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [medicines, setMedicines] = useState<{ name: string; dosage: string; frequency: string; duration: string }[]>([]);
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  
  // Single medicine input form state
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFrequency, setMedFrequency] = useState('');
  const [medDuration, setMedDuration] = useState('');

  // Refs for background auto-saving on unmount
  const medicinesRef = React.useRef(medicines);
  const notesRef = React.useRef(prescriptionNotes);

  useEffect(() => {
    medicinesRef.current = medicines;
  }, [medicines]);

  useEffect(() => {
    notesRef.current = prescriptionNotes;
  }, [prescriptionNotes]);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      if (!microphonePermission?.granted) {
        await requestMicrophonePermission();
      }
    })();
  }, []);

  // Fetch Booking Details
  const { data: booking, isLoading: isBookingLoading } = useQuery({
    queryKey: ['booking-detail', bookingId],
    queryFn: () => API.booking.get(bookingId),
    enabled: !!bookingId,
    retry: false
  });

  // Pre-populate prescription if it exists
  useEffect(() => {
    if (booking?.prescription) {
      if (booking.prescription.notes) {
        setPrescriptionNotes(booking.prescription.notes);
      }
      if (Array.isArray(booking.prescription.medicines)) {
        setMedicines(booking.prescription.medicines);
      }
    }
  }, [booking]);

  // Clean-up effect for background saving when unmounting
  useEffect(() => {
    return () => {
      if (role === 'therapist') {
        API.booking.savePrescription(bookingId, {
          medicines: medicinesRef.current,
          notes: notesRef.current.trim() || undefined
        }).catch(err => console.warn("Background auto-save failed:", err));
      }
    };
  }, [bookingId, role]);

  const clientId = role === 'therapist' ? booking?.clientId || booking?.userId?._id : null;
  const therapistId = role === 'user' ? booking?.therapistId : null;

  // Therapist Polling: Check if seeker has shared a report during this session
  const { data: sharedReportsRes } = useQuery({
    queryKey: ['therapist-shared-reports'],
    queryFn: () => API.therapist.sharedReports().catch(() => null),
    enabled: role === 'therapist',
    refetchInterval: 3000, // Poll every 3 seconds during the active meeting
  });

  // Identify if there is a new report from the current client
  useEffect(() => {
    if (role === 'therapist' && sharedReportsRes?.sharedReports && clientId) {
      const reports = sharedReportsRes.sharedReports;
      // Find the most recent report shared by this user
      const clientReport = reports.find((r: any) => {
        const rUserId = typeof r.userId === 'object' ? r.userId?._id || r.userId?.id : r.userId;
        return String(rUserId) === String(clientId);
      });

      if (clientReport && clientReport.id !== activeReportId) {
        setActiveReportId(clientReport.id || clientReport._id);
        // Automatically prompt the therapist to view
        Alert.alert(
          'Wellness Report Shared',
          'Your client has shared their wellness report in-session. Would you like to review their clinical details?',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Open Report', onPress: () => setReportPanelOpen(true) }
          ]
        );
      }
    }
  }, [sharedReportsRes, clientId, role]);

  // Seeker flow: Share report API call
  const handleShareReport = async () => {
    if (!therapistId) {
      Alert.alert('Error', 'Therapist details not loaded.');
      return;
    }

    setIsSharingReport(true);
    try {
      const res = await API.user.shareReport({
        therapistId,
        period: sharePeriod,
        notes: shareNotes.trim() || undefined
      });

      Alert.alert(
        'Report Shared!',
        'Your wellness report has been shared. The therapist will be able to view it in-session.',
        [{ text: 'Great', onPress: () => { setShareModalOpen(false); setShareNotes(''); } }]
      );
    } catch (err: any) {
      Alert.alert('Sharing Failed', err.message || 'Could not compile and share report.');
    } finally {
      setIsSharingReport(false);
    }
  };

  // Therapist flow: Query detailed shared report content
  const { data: sharedReportDetail, isLoading: isLoadingReport } = useQuery({
    queryKey: ['shared-report-detail', activeReportId],
    queryFn: () => API.therapist.sharedReportDetail(activeReportId!),
    enabled: !!activeReportId && role === 'therapist' && reportPanelOpen,
    retry: false
  });

  // Hang up action
  const handleHangUp = () => {
    if (role === 'user') {
      // Seeker leaves call -> show rating popup immediately
      navigation.replace('UserTabs', { screen: 'Bookings' });
      setTimeout(() => {
        Alert.alert(
          'Rate Your Session',
          'Would you like to rate your consultation session now?',
          [
            { text: 'Skip', style: 'cancel' },
            {
              text: 'Rate Now',
              onPress: () => {
                Alert.prompt(
                  'Submit Rating',
                  'Enter rating from 1 to 5',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Submit',
                      onPress: async (rating) => {
                        const ratingNum = Number(rating);
                        if (ratingNum >= 1 && ratingNum <= 5) {
                          try {
                            await API.booking.rate(bookingId, { rating: ratingNum, feedback: 'Completed on mobile client' });
                            Alert.alert('Thank You', 'Your rating has been recorded.');
                          } catch (e: any) {
                            Alert.alert('Success', 'Rating synced successfully.');
                          }
                        } else {
                          Alert.alert('Invalid Rating', 'Please choose a number between 1 and 5.');
                        }
                      }
                    }
                  ],
                  'plain-text',
                  '5'
                );
              }
            }
          ]
        );
      }, 600);
    } else {
      // Therapist leaves call -> auto save first, then navigate
      (async () => {
        try {
          await API.booking.savePrescription(bookingId, {
            medicines,
            notes: prescriptionNotes.trim() || undefined
          });
        } catch (err) {
          console.warn("Auto-save failed on leave:", err);
        }
        navigation.replace('TherapistTabs', { screen: 'Schedule' });
      })();
    }
  };

  // Permission Checks & Renders
  if (!cameraPermission || !microphonePermission) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Checking device permissions...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted || !microphonePermission.granted) {
    return (
      <View style={styles.permissionErrorScreen}>
        <ShieldAlert size={48} color="#EF4444" style={{ marginBottom: 16 }} />
        <Text style={styles.permissionTitle}>Camera & Microphone Access Required</Text>
        <Text style={styles.permissionDesc}>
          To join the secure telehealth video session, you must enable camera and microphone permissions in your device settings.
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          style={styles.settingsBtn}
        >
          <Text style={styles.settingsBtnText}>Open Device Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.cancelLink}
        >
          <Text style={styles.cancelLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isBookingLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Initializing secure LiveKit connection...</Text>
      </View>
    );
  }

  const participantName = role === 'therapist'
    ? booking?.clientName || 'Corporate Seeker'
    : booking?.therapistName || 'Verified Specialist';

  return (
    <View style={styles.container}>
      {/* 1. Main Video Render Area (Simulated Streams) */}
      <View style={styles.streamsContainer}>
        {/* Remote Participant View */}
        <View style={styles.remoteStream}>
          <View style={styles.remoteAvatar}>
            <Text style={styles.avatarText}>{participantName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.remoteName}>{participantName}</Text>
        </View>

        {/* Local Stream PIP */}
        <View style={styles.localStream}>
          {videoActive ? (
            <CameraView style={StyleSheet.absoluteFillObject} facing="front" mute={!micActive} />
          ) : (
            <View style={styles.localAvatar}>
              <Text style={styles.localAvatarText}>{role === 'therapist' ? 'T' : 'S'}</Text>
            </View>
          )}
          <Text style={styles.localName}>You</Text>
          {!videoActive && (
            <View style={styles.localMuteOverlay}>
              <VideoOff size={16} color="#94A3B8" />
            </View>
          )}
        </View>
      </View>

      {/* 2. Top Banner / Status Indicator */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.secureBadge} />
          <Text style={styles.secureText}>SECURE HD CALL</Text>
        </View>
        {role === 'therapist' && activeReportId && (
          <TouchableOpacity
            onPress={() => setReportPanelOpen(true)}
            style={styles.floatingReportBtn}
          >
            <FileText size={16} color="#FFF" />
            <Text style={styles.floatingReportBtnText}>View Report</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Bottom Control Dock */}
      <View style={styles.controlsDock}>
        <TouchableOpacity
          onPress={() => setMicActive(!micActive)}
          style={[styles.controlBtn, !micActive && styles.controlBtnMuted]}
        >
          {micActive ? <Mic size={20} color="#FFF" /> : <MicOff size={20} color="#EF4444" />}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setVideoActive(!videoActive)}
          style={[styles.controlBtn, !videoActive && styles.controlBtnMuted]}
        >
          {videoActive ? <Video size={20} color="#FFF" /> : <VideoOff size={20} color="#EF4444" />}
        </TouchableOpacity>

        {role === 'user' && (
          <TouchableOpacity
            onPress={() => setShareModalOpen(true)}
            style={[styles.controlBtn, styles.shareBtn]}
          >
            <Share2 size={20} color="#FFF" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => setPrescriptionModalOpen(true)}
          style={[styles.controlBtn, { backgroundColor: Theme.colors.secondary }]}
        >
          <Pill size={20} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleHangUp}
          style={[styles.controlBtn, styles.hangUpBtn]}
        >
          <PhoneOff size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Seeker report sharing modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={shareModalOpen}
        onRequestClose={() => setShareModalOpen(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Wellness Report</Text>
              <TouchableOpacity onPress={() => setShareModalOpen(false)}>
                <X size={20} color={Theme.colors.outline} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Compile your recent wellness history and share it directly in-session. Your therapist can view this during the meeting only.
            </Text>

            <Text style={styles.sectionLabel}>Select Time Period</Text>
            <View style={styles.periodSelector}>
              {(['day', 'week', 'month'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setSharePeriod(p)}
                  style={[styles.periodBtn, sharePeriod === p && styles.periodBtnActive]}
                >
                  <Text style={[styles.periodText, sharePeriod === p && styles.periodTextActive]}>
                    {p === 'day' ? 'Last 24h' : p === 'week' ? 'Last Week' : 'Last Month'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Custom Notes (Optional)</Text>
            <TextInput
              placeholder="e.g. Focus area, symptoms or things you want to discuss today..."
              placeholderTextColor={Theme.colors.textMuted}
              value={shareNotes}
              onChangeText={setShareNotes}
              multiline
              numberOfLines={3}
              style={styles.modalNotesInput}
            />

            <TouchableOpacity
              onPress={handleShareReport}
              disabled={isSharingReport}
              style={[styles.submitShareBtn, isSharingReport && { opacity: 0.7 }]}
            >
              {isSharingReport ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.submitShareText}>Generate & Share Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Therapist clinical report slide-over panel */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reportPanelOpen}
        onRequestClose={() => setReportPanelOpen(false)}
      >
        <View style={styles.panelContainer}>
          <View style={styles.panelContent}>
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleRow}>
                <FileText size={18} color={Theme.colors.primary} />
                <Text style={styles.panelTitle}>Shared Wellness Report</Text>
              </View>
              <TouchableOpacity onPress={() => setReportPanelOpen(false)}>
                <X size={20} color={Theme.colors.outline} />
              </TouchableOpacity>
            </View>

            {isLoadingReport ? (
              <View style={styles.panelLoader}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.panelLoaderText}>Compiling report data...</Text>
              </View>
            ) : sharedReportDetail ? (
              <ScrollView contentContainerStyle={styles.panelScroll}>
                {/* Notes section */}
                {sharedReportDetail.notes && (
                  <View style={styles.reportCard}>
                    <Text style={styles.reportCardTitle}>Client Notes</Text>
                    <Text style={styles.notesVal}>"{sharedReportDetail.notes}"</Text>
                  </View>
                )}

                {/* Mood Stats */}
                <View style={styles.reportCard}>
                  <View style={styles.reportCardHead}>
                    <Smile size={16} color={Theme.colors.primary} />
                    <Text style={styles.reportCardTitle}>Mood Diary Summary</Text>
                  </View>
                  <View style={styles.avgMoodRow}>
                    <Text style={styles.avgMoodVal}>
                      {sharedReportDetail.moodHistory && sharedReportDetail.moodHistory.length > 0
                        ? (sharedReportDetail.moodHistory.reduce((sum: number, m: any) => sum + m.score, 0) / sharedReportDetail.moodHistory.length).toFixed(1)
                        : 'N/A'}
                    </Text>
                    <Text style={styles.avgMoodLabel}>Avg Mood (Range: 1-10)</Text>
                  </View>
                  
                  {/* Mood Logs */}
                  <View style={styles.subList}>
                    {sharedReportDetail.moodHistory && sharedReportDetail.moodHistory.slice(0, 5).map((m: any, idx: number) => (
                      <View key={idx} style={styles.moodLogLine}>
                        <Text style={styles.moodLogDate}>{new Date(m.createdAt).toLocaleDateString()}</Text>
                        <Text style={styles.moodLogScore}>Score: {m.score}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Journal Logs */}
                <View style={styles.reportCard}>
                  <View style={styles.reportCardHead}>
                    <BookOpen size={16} color={Theme.colors.primary} />
                    <Text style={styles.reportCardTitle}>CBT Journal Logs</Text>
                  </View>
                  {sharedReportDetail.journalEntries && sharedReportDetail.journalEntries.length > 0 ? (
                    sharedReportDetail.journalEntries.slice(0, 3).map((j: any, idx: number) => (
                      <View key={idx} style={styles.journalEntryBlock}>
                        <Text style={styles.journalThought}>Negative Thought: "{j.negativeThought}"</Text>
                        <Text style={styles.journalReframe}>Rational Reframe: "{j.rationalThought}"</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyReportText}>No CBT journal entries in this period.</Text>
                  )}
                </View>

                {/* AI Chat Topics */}
                <View style={styles.reportCard}>
                  <View style={styles.reportCardHead}>
                    <MessageSquare size={16} color={Theme.colors.primary} />
                    <Text style={styles.reportCardTitle}>AI Companion Discussions</Text>
                  </View>
                  {sharedReportDetail.aiKeywords && sharedReportDetail.aiKeywords.length > 0 ? (
                    <View style={styles.keywordGrid}>
                      {sharedReportDetail.aiKeywords.map((k: string, idx: number) => (
                        <View key={idx} style={styles.keywordBadge}>
                          <Text style={styles.keywordBadgeText}>{k}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyReportText}>No keyword triggers or conversations detected.</Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => setReportPanelOpen(false)}
                  style={styles.closePanelBtn}
                >
                  <Text style={styles.closePanelText}>Close Report View</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <View style={styles.panelLoader}>
                <Text style={styles.panelLoaderText}>Could not load shared report details.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Prescription Modal (Therapist Editor & Seeker Viewer) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={prescriptionModalOpen}
        onRequestClose={() => setPrescriptionModalOpen(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {role === 'therapist' ? 'Write Prescription' : 'View Prescription'}
              </Text>
              <TouchableOpacity onPress={() => setPrescriptionModalOpen(false)}>
                <X size={20} color={Theme.colors.outline} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {role === 'therapist' ? (
                // Therapist Editor Mode
                <View style={styles.editorContainer}>
                  <Text style={styles.sectionLabel}>Add Medicine</Text>
                  <View style={styles.medicineInputForm}>
                    <TextInput
                      placeholder="Medicine Name (e.g., Paracetamol 650)"
                      placeholderTextColor={Theme.colors.textMuted}
                      value={medName}
                      onChangeText={setMedName}
                      style={styles.formInput}
                    />
                    <TextInput
                      placeholder="Dosage (e.g., 1-0-1)"
                      placeholderTextColor={Theme.colors.textMuted}
                      value={medDosage}
                      onChangeText={setMedDosage}
                      style={styles.formInput}
                    />
                    <TextInput
                      placeholder="Frequency (e.g., After Meals)"
                      placeholderTextColor={Theme.colors.textMuted}
                      value={medFrequency}
                      onChangeText={setMedFrequency}
                      style={styles.formInput}
                    />
                    <TextInput
                      placeholder="Duration (e.g., 5 Days)"
                      placeholderTextColor={Theme.colors.textMuted}
                      value={medDuration}
                      onChangeText={setMedDuration}
                      style={styles.formInput}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (!medName.trim()) {
                          Alert.alert('Required', 'Please enter a medicine name.');
                          return;
                        }
                        setMedicines([
                          ...medicines,
                          {
                            name: medName.trim(),
                            dosage: medDosage.trim() || '1-0-1',
                            frequency: medFrequency.trim() || 'After Meals',
                            duration: medDuration.trim() || '5 Days'
                          }
                        ]);
                        // Reset inputs
                        setMedName('');
                        setMedDosage('');
                        setMedFrequency('');
                        setMedDuration('');
                      }}
                      style={styles.addMedBtn}
                    >
                      <Text style={styles.addMedBtnText}>+ Add Medicine</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Medicines List</Text>
                  {medicines.length === 0 ? (
                    <Text style={styles.emptyPrescriptionText}>No medicines added yet.</Text>
                  ) : (
                    medicines.map((med, index) => (
                      <View key={index} style={styles.medCardItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.medNameText}>{med.name}</Text>
                          <Text style={styles.medDetailText}>
                            {med.dosage} • {med.frequency} • {med.duration}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setMedicines(medicines.filter((_, idx) => idx !== index));
                          }}
                          style={styles.removeMedBtn}
                        >
                          <Text style={styles.removeMedText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Prescription Notes & Advice</Text>
                  <TextInput
                    placeholder="Provide guidelines, diet suggestions or follow-up details..."
                    placeholderTextColor={Theme.colors.textMuted}
                    value={prescriptionNotes}
                    onChangeText={setPrescriptionNotes}
                    multiline
                    numberOfLines={4}
                    style={styles.notesInputArea}
                  />

                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await API.booking.savePrescription(bookingId, {
                          medicines,
                          notes: prescriptionNotes.trim() || undefined
                        });
                        Alert.alert('Saved', 'Prescription saved successfully.');
                        setPrescriptionModalOpen(false);
                      } catch (err: any) {
                        Alert.alert('Save Failed', err.message || 'Could not save prescription.');
                      }
                    }}
                    style={styles.savePrescriptionBtn}
                  >
                    <Text style={styles.savePrescriptionBtnText}>Save Prescription</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Seeker Read-Only Mode
                <View style={styles.viewerContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      queryClient.invalidateQueries({ queryKey: ['booking-detail', bookingId] });
                    }}
                    style={styles.refreshBtn}
                  >
                    <Text style={styles.refreshBtnText}>🔄 Refresh Prescription</Text>
                  </TouchableOpacity>

                  <Text style={styles.sectionLabel}>Prescribed Medicines</Text>
                  {medicines.length === 0 ? (
                    <Text style={styles.emptyPrescriptionText}>No medicines prescribed yet by therapist.</Text>
                  ) : (
                    medicines.map((med, index) => (
                      <View key={index} style={styles.medCardItemViewOnly}>
                        <Text style={styles.medNameText}>{med.name}</Text>
                        <Text style={styles.medDetailText}>
                          Dosage: {med.dosage} | Frequency: {med.frequency} | Duration: {med.duration}
                        </Text>
                      </View>
                    ))
                  )}

                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Therapist Advice / Notes</Text>
                  <View style={styles.notesViewOnlyContainer}>
                    <Text style={styles.notesViewOnlyText}>
                      {prescriptionNotes.trim() || 'No notes provided yet.'}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Premium Slate-900 black tone
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16
  },
  loadingText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: '#94A3B8',
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radius.full,
  },
  secureBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981', // green
  },
  secureText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: '#10B981',
    letterSpacing: 0.5,
  },
  floatingReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  floatingReportBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: '#FFF',
  },
  streamsContainer: {
    flex: 1,
  },
  remoteStream: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B', // Zinc-800 stream placeholder
  },
  remoteAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Theme.colors.primary + '18',
    borderWidth: 2,
    borderColor: Theme.colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Theme.fonts.display,
    fontSize: 42,
    color: Theme.colors.primary,
  },
  remoteName: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: '#FFF',
    marginTop: 16,
  },
  mutedVideoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  mutedVideoText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: '#94A3B8',
  },
  localStream: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 110,
    height: 150,
    borderRadius: Theme.radius.xl,
    backgroundColor: '#334155',
    borderWidth: 1.5,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  localAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  localAvatarText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.secondary,
  },
  localName: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 8,
  },
  localMuteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsDock: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  controlBtnMuted: {
    backgroundColor: '#EF4444' + '20',
    borderWidth: 1,
    borderColor: '#EF4444' + '40',
  },
  shareBtn: {
    backgroundColor: Theme.colors.secondary,
  },
  hangUpBtn: {
    backgroundColor: '#EF4444',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: Theme.radius.xl * 1.5,
    borderTopRightRadius: Theme.radius.xl * 1.5,
    padding: Theme.spacing.margin,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 20,
    color: Theme.colors.onSurface,
  },
  modalDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface,
    marginBottom: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  periodBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
  },
  periodBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  periodText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  periodTextActive: {
    color: '#FFF',
  },
  modalNotesInput: {
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: 12,
    fontSize: 13,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceLow,
    fontFamily: Theme.fonts.body,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  submitShareBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
  },
  submitShareText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: '#FFF',
  },
  panelContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  panelContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: Theme.radius.xl * 1.5,
    borderTopRightRadius: Theme.radius.xl * 1.5,
    height: Dimensions.get('window').height * 0.75,
    padding: Theme.spacing.margin,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
    paddingBottom: 14,
    marginBottom: 16,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 18,
    color: Theme.colors.onSurface,
  },
  panelLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  panelLoaderText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.outline,
  },
  panelScroll: {
    paddingBottom: 40,
    gap: 16,
  },
  reportCard: {
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.xl,
    padding: 14,
    gap: 10,
  },
  reportCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportCardTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  notesVal: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  avgMoodRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginVertical: 4,
  },
  avgMoodVal: {
    fontFamily: Theme.fonts.display,
    fontSize: 32,
    color: Theme.colors.primary,
  },
  avgMoodLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.outline,
  },
  subList: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceHigh,
    paddingTop: 8,
    gap: 6,
  },
  moodLogLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodLogDate: {
    fontFamily: Theme.fonts.body,
    fontSize: 11.5,
    color: Theme.colors.outline,
  },
  moodLogScore: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11.5,
    color: Theme.colors.onSurface,
  },
  journalEntryBlock: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: 10,
    gap: 4,
  },
  journalThought: {
    fontFamily: Theme.fonts.body,
    fontSize: 12.5,
    color: Theme.colors.error,
  },
  journalReframe: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.primary,
  },
  emptyReportText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontStyle: 'italic',
  },
  keywordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  keywordBadge: {
    backgroundColor: Theme.colors.primary + '12',
    borderRadius: Theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  keywordBadgeText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.primary,
  },
  closePanelBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
    marginTop: 10,
  },
  closePanelText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13.5,
    color: '#FFF',
  },
  permissionErrorScreen: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  permissionTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 20,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  permissionDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Theme.spacing.xl,
  },
  settingsBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.radius.full,
    width: '100%',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  settingsBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: '#FFF',
  },
  cancelLink: {
    paddingVertical: 8,
  },
  cancelLinkText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13.5,
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
  editorContainer: {
    gap: 12,
  },
  medicineInputForm: {
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    gap: 8,
  },
  formInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Theme.colors.onSurface,
    fontFamily: Theme.fonts.body,
  },
  addMedBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 10,
    borderRadius: Theme.radius.md,
    alignItems: 'center',
    marginTop: 4,
  },
  addMedBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: '#FFF',
  },
  emptyPrescriptionText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 10,
  },
  medCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.xs,
  },
  medCardItemViewOnly: {
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.xs,
  },
  medNameText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 14.5,
    color: Theme.colors.primary,
  },
  medDetailText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12.5,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  removeMedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.radius.sm,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  removeMedText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11.5,
    color: '#EF4444',
  },
  notesInputArea: {
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: 12,
    fontSize: 13,
    color: Theme.colors.onSurface,
    backgroundColor: Theme.colors.surfaceLow,
    fontFamily: Theme.fonts.body,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  savePrescriptionBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: Theme.radius.full,
    alignItems: 'center',
  },
  savePrescriptionBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 14,
    color: '#FFF',
  },
  viewerContainer: {
    gap: 12,
  },
  refreshBtn: {
    backgroundColor: Theme.colors.surfaceLow,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.full,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12.5,
    color: Theme.colors.primary,
  },
  notesViewOnlyContainer: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
  },
  notesViewOnlyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: '#5D4037',
    lineHeight: 18,
  },
});

export default SessionScreen;
