import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Dimensions, Modal } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Svg, { Line, Path, Circle, Text as SvgText, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { ArrowLeft, Calendar, AlertCircle, Sparkles, Clock, Heart, Smile, CheckCircle2, Wallet, Plus, Share2, FileText, Download, ChevronRight } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import API from '../../lib/api';
import { Theme } from '../../theme';

interface ReportsScreenProps {
  navigation: any;
}

const AI_DOCTORS = [
  { name: 'Dr. Amy Reid', role: 'AI CBT Specialist', initials: 'AR', avatarBg: '#1E88E5' },
  { name: 'Dr. Soniya', role: 'AI Mindfulness Specialist', initials: 'DS', avatarBg: '#8E24AA' },
  { name: 'Dr. Lisa', role: 'AI Trauma-Informed Specialist', initials: 'DL', avatarBg: '#E91E63' },
  { name: 'Dr. Mohan', role: 'AI Positive Psychology Expert', initials: 'DM', avatarBg: '#FFB300' },
  { name: 'Dr. Ram', role: 'AI Clinical Wellness Counselor', initials: 'DR', avatarBg: '#43A047' }
];

const screenWidth = Dimensions.get('window').width;
const paddingX = Theme.spacing.margin * 2;

function moodColor(score: number) {
  if (score <= 3) return '#DE4E37';
  if (score <= 5) return '#E5963E';
  if (score <= 7) return '#7FB355';
  return '#429272';
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<'day' | 'week' | 'fortnight' | 'month'>('fortnight');
  const [selectedAIDoctor, setSelectedAIDoctor] = useState('Dr. Amy Reid');
  const [selectedTherapist, setSelectedTherapist] = useState<{ id: string; name: string } | null>(null);
  const [therapistModalVisible, setTherapistModalVisible] = useState(false);
  const [notes, setNotes] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: reportData, isLoading: reportLoading, refetch: refetchReport } = useQuery({
    queryKey: ['report', period],
    queryFn: () => API.user.getReport(period),
  });

  const calculateUrgency = () => {
    if (!reportData) return { score: 5, label: 'Moderate', color: '#E5963E' };
    let score = 5;
    
    if (reportData.avgMood !== null) {
      const avg = reportData.avgMood;
      if (avg <= 3) score += 3.5;
      else if (avg <= 5) score += 2.0;
      else if (avg >= 8) score -= 2.0;
      else if (avg >= 7) score -= 1.0;
    }
    
    const hasHighRiskChat = (reportData.chats || []).some((c: any) => c.riskLevel === 'high');
    const hasMedRiskChat = (reportData.chats || []).some((c: any) => c.riskLevel === 'medium');
    if (hasHighRiskChat) score += 2.5;
    else if (hasMedRiskChat) score += 1.2;
    
    const journalCount = reportData.journals?.length || 0;
    if (journalCount > 2) score += 1.0;
    
    const finalScore = Math.max(1, Math.min(10, Number(score.toFixed(1))));
    
    let label = 'Moderate';
    let color = '#E5963E'; // Amber
    if (finalScore <= 4.0) {
      label = 'Low Need';
      color = '#429272'; // Teal/Green
    } else if (finalScore >= 7.5) {
      label = 'High Need';
      color = '#DE4E37'; // Rose/Red
    }
    
    return { score: finalScore, label, color };
  };

  const getDoctorRecommendation = () => {
    switch (selectedAIDoctor) {
      case 'Dr. Amy Reid':
        return {
          endorsement: "Endorsement & Analysis: I have carefully reviewed your emotional log trends. Your automated thought patterns show active cognitive distortions (like catastrophizing or all-or-nothing thinking).",
          therapyNeed: "Why Therapy is Recommended: Engaging in structured CBT sessions with a professional therapist will help you build systematic tools to challenge and restructure these negative thoughts, preventing emotional spiral cycles."
        };
      case 'Dr. Soniya':
        return {
          endorsement: "Endorsement & Analysis: I have analyzed your mood logs and daily reflections. There is significant variation in your daily stress indicators and tension loops.",
          therapyNeed: "Why Therapy is Recommended: Taking therapy is highly recommended to build professional mindfulness and grounding practices. A therapist will guide you to observe thoughts without judgment and stabilize emotional reactivity."
        };
      case 'Dr. Lisa':
        return {
          endorsement: "Endorsement & Analysis: Looking at your journaling and chat summaries, there are repeated emotional triggers and deep-seated distress points.",
          therapyNeed: "Why Therapy is Recommended: Working with a trauma-informed professional therapist is crucial. Therapy provides a structured, safe environment to address core emotional wounds, process triggers, and develop somatic healing strategies."
        };
      case 'Dr. Mohan':
        return {
          endorsement: "Endorsement & Analysis: Reviewing your coverage period logs shows a tendency to focus on adverse outcomes and self-critical narratives.",
          therapyNeed: "Why Therapy is Recommended: I recommend taking positive psychology-informed therapy to cultivate optimism, identify character strengths, and build self-compassion. A therapist will help shift your default focus to growth."
        };
      case 'Dr. Ram':
      default:
        return {
          endorsement: "Endorsement & Analysis: Based on the density of your logs and average mood tracking, you are managing considerable day-to-day anxiety and mental workload.",
          therapyNeed: "Why Therapy is Recommended: Regular clinical therapy is highly recommended. A licensed counselor can provide objective support, validate your experiences, and help you design tailored wellness action plans for sustained recovery."
        };
    }
  };

  const urgency = calculateUrgency();
  const doctorRec = getDoctorRecommendation();

  const handleDownload = async () => {
    if (!reportData) {
      Alert.alert('Error', 'No report data loaded to download.');
      return;
    }
    setDownloading(true);
    try {
      const normalSummaryHtml = reportData.normalSummary ? `
        <div class="section">
          <h2>Summary</h2>
          <p>${reportData.normalSummary}</p>
        </div>
      ` : '';

      const clinicalAnalysisHtml = reportData.aiReport?.paid ? `
        <div class="section clinical">
          <h2>Clinical Therapist Evaluation</h2>
          <p class="doctor">Reviewed & signed by: <strong>${selectedAIDoctor}</strong></p>
          <p style="font-style: italic; font-size: 13px; color: #2E6E65;">
            "${reportData.aiReport.aiAnalysis.replaceAll('Dr. Manas', selectedAIDoctor)}"
          </p>
        </div>
      ` : '';

      const moodsHtml = (reportData.moods || []).map((m: any) => {
        const tagsHtml = m.tags && m.tags.length > 0 ? `
          <div class="mood-tags">
            ${m.tags.slice(0, 3).map((t: string) => `<span class="mood-tag">${t}</span>`).join('')}
          </div>
        ` : '';
        return `
          <div class="grid-item">
            <span class="date">${new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            <span class="score" style="background-color: ${moodColor(m.score)};">${m.score}</span>
            ${m.note ? `<p class="note">"${m.note}"</p>` : ''}
            ${tagsHtml}
          </div>
        `;
      }).join('');

      const journalsHtml = (reportData.journals || []).map((j: any) => {
        const aiRefHtml = j.aiResponse ? `
          <div class="journal-ai">
            <p class="ai-title">Manas AI Reflection</p>
            <p class="ai-body">"${j.aiResponse}"</p>
          </div>
        ` : '';
        return `
          <div class="journal-card">
            <div class="journal-header">
              <strong>Prompt: ${j.prompt}</strong>
              <span class="date">${new Date(j.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
            <table class="journal-table">
              <tr><td><strong>Situation</strong></td><td>${j.situation || 'N/A'}</td></tr>
              <tr><td><strong>Automatic Thought</strong></td><td>${j.thought || 'N/A'}</td></tr>
              <tr><td><strong>Emotional Feeling</strong></td><td>${j.feeling || 'N/A'}</td></tr>
              <tr><td><strong>Reframed Narrative</strong></td><td style="color: #0d564d; font-weight: bold;">${j.reframe || 'N/A'}</td></tr>
            </table>
            ${aiRefHtml}
          </div>
        `;
      }).join('');

      const chatsHtml = (reportData.chats || []).map((c: any) => `
        <div class="chat-card">
          <div class="chat-header" style="display: flex; justify-content: space-between; align-items: center;">
            <strong>Session ID: #${c.sessionId?.slice(-6) || 'N/A'}</strong>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span class="badge ${c.riskLevel === 'high' ? 'risk-high' : c.riskLevel === 'medium' ? 'risk-med' : 'risk-low'}">Risk: ${c.riskLevel.toUpperCase()}</span>
              <span style="font-size: 10px; color: #6F7977; font-weight: bold;">${new Date(c.updatedAt).toLocaleDateString('en-IN')}</span>
            </div>
          </div>
          <p style="margin-top: 8px; font-size: 11px; color: #1A1C1C;">${c.summary}</p>
        </div>
      `).join('');

      const urgencyHtml = `
        <div class="section urgency-card">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <h3 style="margin: 0; color: #0d564d; font-size: 14px;">Therapy Urgency Index</h3>
            <span style="font-size: 11px; font-weight: bold; color: ${urgency.color}; background-color: ${urgency.color}15; padding: 3px 8px; border-radius: 10px;">
              ${urgency.label} (${urgency.score}/10)
            </span>
          </div>
          <div style="height: 8px; background-color: #ECEFF1; border-radius: 4px; margin: 10px 0 6px 0; position: relative; width: 100%;">
            <div style="height: 100%; width: ${urgency.score * 10}%; background-color: ${urgency.color}; border-radius: 4px;"></div>
          </div>
          <p style="margin: 0; font-size: 10px; color: #6F7977;">
            Calculated from your average mood of ${reportData.avgMood !== null ? `${reportData.avgMood}/10` : 'None'} over ${reportData.moods?.length || 0} logs and recent activity indicators.
          </p>
        </div>
      `;

      const recommendationHtml = `
        <div class="section clinical" style="border-left: 5px solid #0d564d; background-color: #FFF; margin-bottom: 25px;">
          <h2 style="color: #0d564d; font-size: 14px; margin-top: 0; margin-bottom: 5px;">Doctor Recommendation & Referral</h2>
          <p class="doctor" style="margin-bottom: 5px;">Endorsed & Signed by: <strong>${selectedAIDoctor}</strong></p>
          <p style="font-size: 12px; color: #3F4947; margin: 4px 0;">${doctorRec.endorsement}</p>
          <p style="font-size: 12px; font-weight: bold; color: #0d564d; margin: 6px 0 0 0;">${doctorRec.therapyNeed}</p>
        </div>
      `;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Wellness Report - MyMindTherapyFriend</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              padding: 40px;
              color: #1A1C1C;
              background-color: #FCFAF7;
              line-height: 1.5;
            }
            .header {
              border-bottom: 2px solid #0d564d;
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .header h1 {
              color: #0d564d;
              margin: 0 0 5px 0;
              font-size: 28px;
            }
            .header p {
              margin: 0;
              font-size: 12px;
              color: #6F7977;
            }
            .meta {
              text-align: right;
              font-size: 12px;
            }
            .meta p {
              margin: 2px 0;
            }
            .overview-grid {
              display: flex;
              background-color: rgba(255,255,255,0.7);
              border-radius: 12px;
              padding: 15px;
              margin-bottom: 30px;
              border: 1px solid rgba(0,0,0,0.05);
            }
            .overview-cell {
              flex: 1;
              text-align: center;
            }
            .overview-cell span {
              display: block;
            }
            .cell-label {
              font-size: 10px;
              font-weight: bold;
              color: #6F7977;
            }
            .cell-val {
              font-size: 16px;
              font-weight: bold;
              color: #0d564d;
              margin-top: 4px;
            }
            .section {
              margin-bottom: 30px;
            }
            .section h2 {
              color: #0d564d;
              font-size: 18px;
              border-bottom: 1px solid #E8E8E7;
              padding-bottom: 6px;
              margin-bottom: 15px;
            }
            .clinical {
              background-color: #fff;
              border: 1px solid #BFC9C6;
              padding: 20px;
              border-radius: 12px;
              border-left: 5px solid #FE8C66;
            }
            .clinical h2 {
              border: none;
              padding: 0;
              margin-top: 0;
            }
            .urgency-card {
              background-color: #fff;
              border: 1px solid #E8E8E7;
              border-radius: 12px;
              padding: 15px;
              margin-bottom: 25px;
            }
            .doctor {
              font-size: 11px;
              color: #6F7977;
              margin-bottom: 10px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
            }
            .grid-item {
              background-color: #fff;
              border: 1px solid #E8E8E7;
              border-radius: 8px;
              padding: 12px;
              position: relative;
            }
            .grid-item .score {
              display: inline-block;
              width: 24px;
              height: 24px;
              border-radius: 12px;
              color: #FFF;
              text-align: center;
              line-height: 24px;
              font-weight: bold;
              font-size: 11px;
              position: absolute;
              top: 12px;
              right: 12px;
            }
            .grid-item .date {
              font-size: 10px;
              color: #6F7977;
            }
            .grid-item .note {
              margin: 8px 0 0 0;
              font-size: 11px;
              color: #3F4947;
              font-style: italic;
            }
            .journal-card, .chat-card {
              background-color: #fff;
              border: 1px solid #E8E8E7;
              border-radius: 12px;
              padding: 15px;
              margin-bottom: 15px;
            }
            .journal-header, .chat-header {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              margin-bottom: 10px;
            }
            .journal-table {
              width: 100%;
              border-collapse: collapse;
            }
            .journal-table td {
              padding: 6px;
              font-size: 11px;
              vertical-align: top;
            }
            .journal-table tr td:first-child {
              width: 30%;
              color: #6F7977;
              font-weight: bold;
            }
            .badge {
              font-size: 9px;
              font-weight: bold;
              padding: 3px 8px;
              border-radius: 10px;
            }
            .risk-high { background-color: #FFEBEE; color: #C62828; }
            .risk-med { background-color: #FFF8E1; color: #F57F17; }
            .risk-low { background-color: #E8F5E9; color: #2E7D32; }
            .mood-tags {
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
              margin-top: 8px;
            }
            .mood-tag {
              font-size: 8px;
              font-weight: bold;
              background-color: rgba(13, 86, 77, 0.1);
              color: #0d564d;
              padding: 2px 6px;
              border-radius: 4px;
            }
            .journal-ai {
              margin-top: 10px;
              padding: 10px;
              background-color: #F0F4F4;
              border-radius: 8px;
              border-left: 3px solid #FE8C66;
            }
            .ai-title {
              font-size: 9px;
              font-weight: bold;
              color: #742406;
              margin: 0 0 4px 0;
            }
            .ai-body {
              font-size: 11px;
              font-style: italic;
              color: #3F4947;
              margin: 0;
            }
            .footer {
              border-top: 1px solid #E8E8E7;
              padding-top: 15px;
              text-align: center;
              font-size: 9px;
              color: #6F7977;
              margin-top: 50px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <p>WELLNESS REPORT</p>
              <h1>MyMindTherapyFriend</h1>
              <p>Your emotional wellness & therapy companion</p>
            </div>
            <div class="meta">
              <p><strong>Generated on:</strong> ${new Date(reportData.endDate).toLocaleDateString('en-IN')}</p>
              <p><strong>Coverage Period:</strong> ${period.toUpperCase()}</p>
            </div>
          </div>

          <div class="overview-grid">
            <div class="overview-cell">
              <span class="cell-label">PATIENT</span>
              <span class="cell-val">${reportData.user?.fullName || 'Anonymous Patient'}</span>
            </div>
            <div class="overview-cell">
              <span class="cell-label">STREAK</span>
              <span class="cell-val">${reportData.user?.streak ?? 0} Days</span>
            </div>
            <div class="overview-cell">
              <span class="cell-label">AVERAGE MOOD</span>
              <span class="cell-val">${reportData.avgMood !== null ? `${reportData.avgMood}/10` : 'None'}</span>
            </div>
          </div>

          ${urgencyHtml}

          ${recommendationHtml}

          ${clinicalAnalysisHtml}

          ${normalSummaryHtml}

          <div class="section">
            <h2>Mood Logs (${reportData.moods?.length || 0})</h2>
            ${reportData.moods?.length === 0 ? '<p style="font-style: italic; font-size:12px;">No mood logs recorded in this period.</p>' : `
              <div class="grid">
                ${moodsHtml}
              </div>
            `}
          </div>

          <div class="section">
            <h2>CBT Journal Reflections (${reportData.journals?.length || 0})</h2>
            ${reportData.journals?.length === 0 ? '<p style="font-style: italic; font-size:12px;">No journal entries logged in this period.</p>' : `
              <div>
                ${journalsHtml}
              </div>
            `}
          </div>

          <div class="section">
            <h2>Manas AI Chat Summaries (${reportData.chats?.length || 0})</h2>
            ${reportData.chats?.length === 0 ? '<p style="font-style: italic; font-size:12px;">No AI chat activity logged in this period.</p>' : `
              <div>
                ${chatsHtml}
              </div>
            `}
          </div>

          <div class="footer">
            <p>MyMindTherapyFriend is an emotional wellness platform. This summary is intended to assist in personal reflection and therapy, and is not a clinical diagnosis.</p>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Failed to generate PDF report.');
    } finally {
      setDownloading(false);
    }
  };

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => API.subscription.get(),
    retry: false,
  });
  const currentTier = subscription?.tier ?? 'free';

  useEffect(() => {
    if (currentTier === 'free') {
      setPeriod('fortnight');
    } else {
      setPeriod('week');
    }
  }, [currentTier]);

  const { data: walletData } = useQuery({
    queryKey: ['walletBalance'],
    queryFn: () => API.payment.getWalletBalance(),
  });
  const walletBalance = walletData?.walletBalance ?? 0;

  const { data: therapistsData } = useQuery({
  queryKey: ['therapists'],
  queryFn: () => API.therapist.list(),
});

  const { data: sharesData, isLoading: sharesLoading } = useQuery({
    queryKey: ['reportShares'],
    queryFn: () => API.user.shares(),
  });

  const shareMutation = useMutation({
    mutationFn: (data: { therapistId: string; period: string; notes?: string }) =>
      API.user.shareReport(data),
    onSuccess: () => {
      Alert.alert('Success', 'Report shared successfully with your therapist!');
      queryClient.invalidateQueries({ queryKey: ['reportShares'] });
      setNotes('');
      setSelectedTherapist(null);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to share report');
    }
  });

  const handleUnlockAIReport = async () => {
    if (!reportData?.startDate || !reportData?.endDate) {
      Alert.alert('Error', 'No report data loaded yet.');
      return;
    }
    if (walletBalance < 29) {
      Alert.alert(
        'Insufficient Balance',
        'You need ₹29 to unlock the report. Go to Wallet?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Wallet', onPress: () => navigation.navigate('Wallet') }
        ]
      );
      return;
    }

    setUnlocking(true);
    try {
      await API.payment.payReportWallet({
        startDate: reportData.startDate,
        endDate: reportData.endDate,
      });
      Alert.alert('Unlocked!', 'AI Therapist Analysis unlocked successfully using wallet!');
      queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
      refetchReport();
    } catch (err: any) {
      Alert.alert('Unlock Failed', err.message || 'Failed to unlock therapist analysis');
    } finally {
      setUnlocking(false);
    }
  };

  const handleShare = () => {
    if (!selectedTherapist) {
      Alert.alert('Required', 'Please select a therapist to share with.');
      return;
    }
    shareMutation.mutate({
      therapistId: selectedTherapist.id,
      period,
      notes: notes.trim() || undefined
    });
  };

  const uniqueTherapists = therapistsData?.therapists ?? [];

  const shares = sharesData?.shares || [];
  const sortedMoods = [...(reportData?.moods || [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // SVG Chart Dimensions
  const chartWidth = screenWidth - paddingX - 32;
  const chartHeight = 150;

  // Build SVG Points
  const points: { x: number; y: number; score: number; dateStr: string }[] = [];
  sortedMoods.forEach((m, i) => {
    const x = sortedMoods.length > 1 ? (i / (sortedMoods.length - 1)) * (chartWidth - 50) + 30 : chartWidth / 2;
    const y = chartHeight - (m.score / 10) * (chartHeight - 50) - 25;
    points.push({
      x,
      y,
      score: m.score,
      dateStr: new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    });
  });

  let pathD = '';
  points.forEach((p, idx) => {
    if (idx === 0) {
      pathD += `M ${p.x} ${p.y}`;
    } else {
      pathD += ` L ${p.x} ${p.y}`;
    }
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header back button */}
      <View style={styles.backRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wellness Reports</Text>
      </View>

      {/* Period Selection */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Calendar size={18} color={Theme.colors.secondary} />
          <Text style={styles.cardTitle}>Choose Timeframe</Text>
        </View>
        <View style={styles.btnRow}>
          {(currentTier === 'free' ? (['day', 'fortnight', 'month'] as const) : (['day', 'week', 'month'] as const)).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={[
                styles.periodBtn,
                period === p && styles.periodBtnActive
              ]}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                {p === 'fortnight' ? '15 Days' : p.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Select Doctor Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Sparkles size={18} color={Theme.colors.primary} />
          <Text style={styles.cardTitle}>Select Doctor Reviewer</Text>
        </View>
        <Text style={styles.cardSub}>Choose who signs the clinical analysis.</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.docScroll}>
          {AI_DOCTORS.map((doc) => {
            const active = selectedAIDoctor === doc.name;
            return (
              <TouchableOpacity
                key={doc.name}
                onPress={() => setSelectedAIDoctor(doc.name)}
                style={[styles.docCard, active && styles.docCardActive]}
              >
                <View style={[styles.docAvatar, { backgroundColor: doc.avatarBg }]}>
                  <Text style={styles.docInitials}>{doc.initials}</Text>
                </View>
                <Text style={styles.docName}>{doc.name}</Text>
                <Text style={styles.docRole}>{doc.role}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Clinical Summary & Unlocking Card */}
      {(period === 'week' || period === 'fortnight') && reportData && (
        <View style={styles.card}>
          <View style={styles.clinicalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Sparkles size={18} color={Theme.colors.secondary} />
              <Text style={styles.cardTitle}>
                {period === 'week' ? 'Weekly' : '15-Day'} Clinical Evaluation
              </Text>
            </View>
            {reportData.aiReport?.paid && (
              <View style={styles.unlockedBadge}>
                <CheckCircle2 size={12} color="#2E7D32" />
                <Text style={styles.unlockedText}>UNLOCKED</Text>
              </View>
            )}
          </View>

          {reportData.aiReport?.paid ? (
            <View style={styles.reportUnlockContent}>
              <View style={styles.docSignatureRow}>
                <View style={[styles.miniDocAvatar, { backgroundColor: AI_DOCTORS.find(d => d.name === selectedAIDoctor)?.avatarBg || Theme.colors.secondaryContainer }]}>
                  <Text style={styles.miniDocInitials}>{AI_DOCTORS.find(d => d.name === selectedAIDoctor)?.initials || 'DM'}</Text>
                </View>
                <View>
                  <Text style={styles.signatureTitle}>Clinical evaluation signed by:</Text>
                  <Text style={styles.signatureName}>{selectedAIDoctor} ({AI_DOCTORS.find(d => d.name === selectedAIDoctor)?.role})</Text>
                </View>
              </View>
              <Text style={styles.clinicalBody}>
                {reportData.aiReport.aiAnalysis.replaceAll('Dr. Manas', selectedAIDoctor)}
              </Text>
            </View>
          ) : (
            <View style={styles.lockedSection}>
              {/* Normal Summary */}
              <View style={styles.normalSummaryBox}>
                <Text style={styles.summaryLabel}>Free Summary</Text>
                <Text style={styles.summaryBody}>{reportData.normalSummary}</Text>
              </View>

              {/* Unlock Banner */}
              <View style={styles.unlockCard}>
                <Sparkles size={24} color="#FFF" style={styles.unlockIcon} />
                <Text style={styles.unlockTitle}>Unlock Expert Clinical Evaluation</Text>
                <Text style={styles.unlockDesc}>
                  Receive a deep psychological analysis of your journal entries, chats, and mood logs reviewed by our AI counselor.
                </Text>
                <View style={styles.divider} />
                <View style={styles.unlockFooter}>
                  <View>
                    <Text style={styles.feeLabel}>Report Fee</Text>
                    <Text style={styles.feeAmount}>₹29.00</Text>
                  </View>
                  {walletBalance >= 29 ? (
                    <TouchableOpacity
                      disabled={unlocking}
                      onPress={handleUnlockAIReport}
                      style={styles.unlockBtn}
                    >
                      {unlocking ? (
                        <ActivityIndicator color={Theme.colors.primary} />
                      ) : (
                        <>
                          <Wallet size={14} color={Theme.colors.primary} />
                          <Text style={styles.unlockBtnText}>Pay from Wallet</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.balText}>Wallet Balance: ₹{walletBalance.toFixed(2)}</Text>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('Wallet')}
                        style={styles.addFundsBtn}
                      >
                        <Plus size={12} color="#FFF" />
                        <Text style={styles.addFundsBtnText}>Add Funds</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Share Report with Therapist */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Share2 size={18} color={Theme.colors.primary} />
          <Text style={styles.cardTitle}>Share with Therapist</Text>
        </View>

        {uniqueTherapists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AlertCircle size={28} color={Theme.colors.textMuted} />
            <Text style={styles.emptyText}>You haven't booked any sessions yet.</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Therapists')}
              style={styles.findBtn}
            >
              <Text style={styles.findBtnText}>Find a Therapist</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.shareForm}>
            <Text style={styles.inputLabel}>1. Select Therapist</Text>
            <TouchableOpacity 
              onPress={() => setTherapistModalVisible(true)} 
              style={styles.pickerTrigger}
            >
              <Text style={styles.pickerText}>
                {selectedTherapist ? selectedTherapist.name : 'Select a therapist'}
              </Text>
              <ChevronRight size={18} color={Theme.colors.outline} />
            </TouchableOpacity>

            <Text style={styles.inputLabel}>2. Message / Notes (Optional)</Text>
            <TextInput
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              placeholder="Hi Doctor, sharing my wellness logs for our next session..."
              placeholderTextColor={Theme.colors.outline}
              style={styles.noteInput}
            />

            <TouchableOpacity
              disabled={shareMutation.isPending}
              onPress={handleShare}
              style={styles.shareSubmitBtn}
            >
              {shareMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Share2 size={16} color="#FFF" />
                  <Text style={styles.shareSubmitBtnText}>Share Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Share History */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Clock size={18} color={Theme.colors.secondary} />
          <Text style={styles.cardTitle}>Sharing History</Text>
        </View>
        {sharesLoading ? (
          <ActivityIndicator color={Theme.colors.primary} />
        ) : shares.length === 0 ? (
          <Text style={styles.noHistory}>No reports shared yet.</Text>
        ) : (
          <View style={styles.historyList}>
            {shares.map((s: any) => (
              <View key={s.id || s._id} style={styles.historyItem}>
                <View style={styles.historyRow}>
                  <Text style={styles.historyName}>Shared with {s.therapistName}</Text>
                  <Text style={styles.historyPeriod}>{s.period.toUpperCase()}</Text>
                </View>
                <Text style={styles.historyDate}>
                  {new Date(s.sharedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
                {s.notes && (
                  <Text style={styles.historyNote}>"{s.notes}"</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Download Action Widget */}
      <View style={styles.downloadCard}>
        <View style={styles.downloadLeft}>
          <View style={styles.downloadIconBox}>
            <FileText size={22} color={Theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.downloadTitle}>Download PDF Report</Text>
            <Text style={styles.downloadDesc}>Get a physical copy of your emotional logs.</Text>
          </View>
        </View>
        <TouchableOpacity
          disabled={downloading || reportLoading}
          onPress={handleDownload}
          style={styles.downloadBtn}
        >
          {downloading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Download size={16} color="#FFF" />
              <Text style={styles.downloadBtnText}>Download</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Report Preview Document */}
      <View style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View>
            <Text style={styles.previewSubtitle}>Previewing Wellness Report</Text>
            <Text style={styles.previewBrand}>MyMindTherapyFriend</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.previewDate}>
              {reportData ? new Date(reportData.endDate).toLocaleDateString('en-IN') : ''}
            </Text>
            <Text style={styles.previewPeriod}>Coverage: {period.toUpperCase()}</Text>
          </View>
        </View>

        {reportLoading ? (
          <View style={{ paddingVertical: 40 }}>
            <ActivityIndicator color={Theme.colors.primary} />
          </View>
        ) : reportData ? (
          <View style={styles.previewContent}>
            {/* Patient overview grid */}
            <View style={styles.overviewGrid}>
              <View style={styles.overviewCell}>
                <Text style={styles.cellLabel}>PATIENT</Text>
                <Text style={styles.cellVal}>{reportData.user?.fullName || 'Anonymous'}</Text>
              </View>
              <View style={styles.overviewCell}>
                <Text style={styles.cellLabel}>STREAK</Text>
                <Text style={styles.cellVal}>{reportData.user?.streak ?? 0} Days</Text>
              </View>
              <View style={styles.overviewCell}>
                <Text style={styles.cellLabel}>AVG MOOD</Text>
                <Text style={styles.cellVal}>
                  {reportData.avgMood !== null ? `${reportData.avgMood}/10` : 'None'}
                </Text>
              </View>
            </View>

            {/* Therapy Urgency Gauge */}
            <View style={styles.urgencySection}>
              <View style={styles.urgencyHeaderRow}>
                <Text style={styles.urgencyLabel}>Therapy Urgency Index</Text>
                <View style={[styles.urgencyBadge, { backgroundColor: urgency.color + '15' }]}>
                  <Text style={[styles.urgencyBadgeText, { color: urgency.color }]}>{urgency.label} ({urgency.score}/10)</Text>
                </View>
              </View>
              <View style={styles.urgencyBarContainer}>
                <View style={styles.urgencyBarBackground} />
                <View style={[styles.urgencyBarFill, { width: `${urgency.score * 10}%`, backgroundColor: urgency.color }]} />
                <View style={[styles.urgencyBarCursor, { left: `${urgency.score * 10}%`, borderColor: urgency.color }]} />
              </View>
              <Text style={styles.urgencyDescText}>
                Computed from your average mood of {reportData.avgMood !== null ? `${reportData.avgMood}/10` : 'None'}, {reportData.journals?.length || 0} journal entries, and chat safety levels.
              </Text>
            </View>

            {/* Doctor Endorsement & Referral Recommendation */}
            <View style={styles.doctorRecCard}>
              <View style={styles.doctorRecHeader}>
                <Sparkles size={16} color={Theme.colors.primary} />
                <Text style={styles.doctorRecTitle}>Doctor Recommendation & Referral</Text>
              </View>
              <Text style={styles.doctorRecSub}>Endorsed & Signed by: {selectedAIDoctor}</Text>
              <View style={styles.doctorRecDivider} />
              <Text style={styles.doctorRecText}>
                {doctorRec.endorsement}
              </Text>
              <Text style={[styles.doctorRecText, { marginTop: 8, fontFamily: Theme.fonts.bodyBold, color: Theme.colors.primary }]}>
                {doctorRec.therapyNeed}
              </Text>
            </View>

            {/* SVG Trend Chart */}
            {sortedMoods.length > 0 && (
              <View style={styles.chartSection}>
                <Text style={styles.sectionHeader}>Mood Trend Graph</Text>
                <View style={styles.chartWrapper}>
                  <Svg width={chartWidth} height={chartHeight}>
                    <Defs>
                      <LinearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={Theme.colors.primary} stopOpacity="0.25" />
                        <Stop offset="100%" stopColor={Theme.colors.primary} stopOpacity="0" />
                      </LinearGradient>
                    </Defs>

                    {/* Level guidelines */}
                    {[2, 4, 6, 8, 10].map((level) => {
                      const y = chartHeight - (level / 10) * (chartHeight - 50) - 25;
                      return (
                        <G key={level}>
                          <Line
                            x1="30"
                            y1={y}
                            x2={chartWidth - 20}
                            y2={y}
                            stroke="#ECEFF1"
                            strokeWidth="1"
                            strokeDasharray="4, 4"
                          />
                          <SvgText x="15" y={y + 3} fill={Theme.colors.textMuted} fontSize="8" fontWeight="bold">
                            {level}
                          </SvgText>
                        </G>
                      );
                    })}

                    {/* Path area */}
                    {points.length > 1 && (
                      <Path
                        d={`M 30 ${chartHeight - 25} L ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${points[points.length - 1].x} ${chartHeight - 25} Z`}
                        fill="url(#moodGrad)"
                      />
                    )}

                    {/* Path line */}
                    {pathD ? (
                      <Path
                        d={pathD}
                        fill="none"
                        stroke={Theme.colors.primary}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {/* Highlight circles & score labels */}
                    {points.map((p, idx) => (
                      <G key={idx}>
                        <Circle cx={p.x} cy={p.y} r="4" fill="#FFF" stroke={Theme.colors.primary} strokeWidth="2" />
                        <Circle cx={p.x} cy={p.y} r="2" fill={Theme.colors.secondary} />
                        <SvgText x={p.x} y={p.y - 8} fill={Theme.colors.primary} fontSize="8" fontWeight="bold" textAnchor="middle">
                          {p.score}
                        </SvgText>
                        <SvgText x={p.x} y={chartHeight - 8} fill={Theme.colors.textMuted} fontSize="7" textAnchor="middle">
                          {p.dateStr}
                        </SvgText>
                      </G>
                    ))}
                  </Svg>
                </View>
              </View>
            )}

            {/* Mood Logs List */}
            <View style={styles.logSection}>
              <Text style={styles.sectionHeader}>Mood Logs ({reportData.moods?.length || 0})</Text>
              {reportData.moods?.length === 0 ? (
                <Text style={styles.italicText}>No mood check-ins recorded.</Text>
              ) : (
                <View style={styles.moodGrid}>
                  {reportData.moods.map((m: any) => (
                    <View key={m.id || m._id} style={styles.moodLogCard}>
                      <View style={styles.moodCardHeader}>
                        <Text style={styles.moodCardDate}>
                          {new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </Text>
                        <View style={[styles.moodScoreCircle, { backgroundColor: moodColor(m.score) }]}>
                          <Text style={styles.moodScoreText}>{m.score}</Text>
                        </View>
                      </View>
                      {m.note ? <Text style={styles.moodCardNote}>"{m.note}"</Text> : null}
                      {m.tags && m.tags.length > 0 ? (
                        <View style={styles.moodTagsContainer}>
                          {m.tags.slice(0, 3).map((t: string, idx: number) => (
                            <View key={idx} style={styles.moodTagBadge}>
                              <Text style={styles.moodTagText}>{t}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* CBT Journal Logs List */}
            <View style={styles.logSection}>
              <Text style={styles.sectionHeader}>CBT Journal Reflections ({reportData.journals?.length || 0})</Text>
              {reportData.journals?.length === 0 ? (
                <Text style={styles.italicText}>No CBT journal sheets logged.</Text>
              ) : (
                <View style={styles.journalList}>
                  {reportData.journals.map((j: any) => (
                    <View key={j.id || j._id} style={styles.journalCard}>
                      <View style={styles.journalCardHeader}>
                        <Text style={styles.journalPrompt} numberOfLines={2}>{j.prompt}</Text>
                        <Text style={styles.journalDate}>
                          {new Date(j.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                      
                      <View style={styles.journalGrid}>
                        <View style={styles.journalGridItem}>
                          <Text style={styles.jColTitle}>SITUATION</Text>
                          <Text style={styles.jColBody}>{j.situation || 'N/A'}</Text>
                        </View>
                        <View style={styles.journalGridItem}>
                          <Text style={styles.jColTitle}>AUTOMATIC THOUGHT</Text>
                          <Text style={styles.jColBody}>{j.thought || 'N/A'}</Text>
                        </View>
                        <View style={styles.journalGridItem}>
                          <Text style={styles.jColTitle}>EMOTIONAL FEELING</Text>
                          <Text style={styles.jColBody}>{j.feeling || 'N/A'}</Text>
                        </View>
                        <View style={styles.journalGridItem}>
                          <Text style={styles.jColTitle}>REFRAMED TRUTH</Text>
                          <Text style={[styles.jColBody, { color: Theme.colors.primary, fontWeight: 'bold' }]}>
                            {j.reframe || 'N/A'}
                          </Text>
                        </View>
                      </View>

                      {j.aiResponse ? (
                        <View style={styles.journalAiResponse}>
                          <Text style={styles.jAiTitle}>Manas AI Reflection</Text>
                          <Text style={styles.jAiBody}>"{j.aiResponse}"</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* AI Chats Sessions List */}
            <View style={styles.logSection}>
              <Text style={styles.sectionHeader}>Manas AI Chat Activity ({reportData.chats?.length || 0})</Text>
              {reportData.chats?.length === 0 ? (
                <Text style={styles.italicText}>No AI chat logs recorded.</Text>
              ) : (
                <View style={styles.chatList}>
                  {reportData.chats.map((c: any, index: number) => (
                    <View key={c.sessionId || index} style={styles.chatCard}>
                      <View style={styles.chatCardHeader}>
                        <Text style={styles.chatSessionId}>Session ID: #{c.sessionId?.slice(-6) || 'N/A'}</Text>
                        <View style={[
                          styles.riskBadge,
                          {
                            backgroundColor: c.riskLevel === 'high' ? '#FFEBEE' : c.riskLevel === 'medium' ? '#FFF8E1' : '#E8F5E9'
                          }
                        ]}>
                          <Text style={[
                            styles.riskText,
                            {
                              color: c.riskLevel === 'high' ? '#C62828' : c.riskLevel === 'medium' ? '#F57F17' : '#2E7D32'
                            }
                          ]}>
                            Risk: {c.riskLevel.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.chatSummary}>{c.summary}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          <Text style={styles.noData}>No data available for this timeframe.</Text>
        )}
      </View>

      {/* Custom Therapist Selector Modal */}
      <Modal
        visible={therapistModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTherapistModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTherapistModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Therapist</Text>
            {uniqueTherapists.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => {
                  setSelectedTherapist(t);
                  setTherapistModalVisible(false);
                }}
                style={styles.modalItem}
              >
                <Text style={styles.modalItemText}>{t.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              onPress={() => setTherapistModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  card: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: Theme.spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.onSurface,
  },
  cardSub: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  periodBtn: {
    flex: 1,
    height: 40,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.surfaceLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: Theme.colors.primary,
  },
  periodBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  periodBtnTextActive: {
    color: '#FFF',
  },
  docScroll: {
    gap: 12,
    paddingVertical: 6,
  },
  docCard: {
    width: 120,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    padding: 10,
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceLow,
    gap: 4,
  },
  docCardActive: {
    borderColor: Theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: Theme.colors.primary + '08',
  },
  docAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInitials: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 14,
  },
  docName: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.onSurface,
    textAlign: 'center',
  },
  docRole: {
    fontFamily: Theme.fonts.body,
    fontSize: 9,
    color: Theme.colors.textMuted,
    textAlign: 'center',
  },
  clinicalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceLow,
    paddingBottom: 8,
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.full,
    gap: 4,
  },
  unlockedText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 8,
    color: '#2E7D32',
  },
  reportUnlockContent: {
    marginTop: Theme.spacing.xs,
    gap: 12,
  },
  docSignatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniDocAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniDocInitials: {
    color: '#FFF',
    fontFamily: Theme.fonts.headline,
    fontSize: 11,
  },
  signatureTitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  signatureName: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.onSurface,
  },
  clinicalBody: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 20,
    fontStyle: 'italic',
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.secondaryContainer,
    paddingLeft: 10,
  },
  lockedSection: {
    marginTop: 8,
    gap: Theme.spacing.sm,
  },
  normalSummaryBox: {
    padding: 12,
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: 4,
  },
  summaryLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: Theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  summaryBody: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
    lineHeight: 18,
  },
  unlockCard: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
    gap: 8,
  },
  unlockIcon: {
    alignSelf: 'flex-start',
  },
  unlockTitle: {
    fontFamily: Theme.fonts.display,
    fontSize: 16,
    color: '#FFF',
  },
  unlockDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 4,
  },
  unlockFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontFamily: Theme.fonts.body,
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
  },
  feeAmount: {
    fontFamily: Theme.fonts.display,
    fontSize: 20,
    color: '#FFF',
    fontWeight: 'bold',
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: Theme.radius.lg,
    gap: 6,
  },
  unlockBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  balText: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  addFundsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.secondaryContainer,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: Theme.radius.md,
    gap: 4,
  },
  addFundsBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 11,
    color: '#FFF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    gap: 6,
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  findBtn: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
  },
  findBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: '#FFF',
  },
  shareForm: {
    gap: Theme.spacing.xs,
    marginTop: 6,
  },
  inputLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  pickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.surfaceLow,
    paddingHorizontal: 12,
  },
  pickerText: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.surfaceLow,
    padding: 12,
    fontSize: 13,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurface,
    textAlignVertical: 'top',
    height: 70,
  },
  shareSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.secondary,
    height: 46,
    borderRadius: Theme.radius.lg,
    gap: 8,
    marginTop: 6,
  },
  shareSubmitBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: '#FFF',
  },
  noHistory: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  historyList: {
    gap: 8,
    marginTop: 6,
  },
  historyItem: {
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: Theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    gap: 4,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyName: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.onSurface,
  },
  historyPeriod: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: Theme.colors.secondary,
  },
  historyDate: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  historyNote: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    fontStyle: 'italic',
    color: Theme.colors.onSurfaceVariant,
    marginTop: 4,
    borderLeftWidth: 2,
    borderLeftColor: Theme.colors.primary + '30',
    paddingLeft: 6,
  },
  previewCard: {
    backgroundColor: '#FCFAF7',
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.primary + '30',
    paddingBottom: Theme.spacing.sm,
  },
  previewSubtitle: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: Theme.colors.secondary,
    letterSpacing: 1,
  },
  previewBrand: {
    fontFamily: Theme.fonts.display,
    fontSize: 18,
    color: Theme.colors.primary,
  },
  previewDate: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: Theme.colors.onSurface,
  },
  previewPeriod: {
    fontFamily: Theme.fonts.body,
    fontSize: 9,
    color: Theme.colors.textMuted,
  },
  previewContent: {
    gap: Theme.spacing.md,
  },
  urgencySection: {
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  urgencyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  urgencyLabel: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.full,
  },
  urgencyBadgeText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
  },
  urgencyBarContainer: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ECEFF1',
    position: 'relative',
    marginVertical: 6,
  },
  urgencyBarBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ECEFF1',
    borderRadius: 4,
  },
  urgencyBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  urgencyBarCursor: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 2,
    top: -2,
    marginLeft: -6,
  },
  urgencyDescText: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  doctorRecCard: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderLeftWidth: 4,
    borderLeftColor: Theme.colors.primary,
    gap: 4,
  },
  doctorRecHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  doctorRecTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface,
  },
  doctorRecSub: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  doctorRecDivider: {
    height: 1,
    backgroundColor: '#ECEFF1',
    marginVertical: 4,
  },
  doctorRecText: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: Theme.radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  overviewCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  cellLabel: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 8,
    color: Theme.colors.textMuted,
  },
  cellVal: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: Theme.colors.primary,
  },
  chartSection: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  sectionHeader: {
    fontFamily: Theme.fonts.headline,
    fontSize: 13,
    color: Theme.colors.onSurface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceLow,
    paddingBottom: 4,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  logSection: {
    gap: 8,
  },
  italicText: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    fontStyle: 'italic',
    color: Theme.colors.textMuted,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodLogCard: {
    width: (screenWidth - paddingX - 40) / 2,
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 4,
  },
  moodCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moodCardDate: {
    fontFamily: Theme.fonts.body,
    fontSize: 9,
    color: Theme.colors.textMuted,
  },
  moodScoreCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodScoreText: {
    color: '#FFF',
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
  },
  moodCardNote: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  moodTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  moodTagBadge: {
    backgroundColor: '#0D564D15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.radius.sm,
  },
  moodTagText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 8,
    color: Theme.colors.primary,
  },
  journalList: {
    gap: 8,
  },
  journalCard: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  journalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Theme.spacing.xs,
  },
  journalPrompt: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 12,
    color: Theme.colors.onSurface,
    flex: 1,
  },
  journalDate: {
    fontFamily: Theme.fonts.body,
    fontSize: 9,
    color: Theme.colors.textMuted,
  },
  journalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  journalGridItem: {
    width: (screenWidth - paddingX - 48) / 2,
    gap: 2,
  },
  journalAiResponse: {
    marginTop: 8,
    padding: 8,
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: Theme.radius.default,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  jAiTitle: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 9,
    color: Theme.colors.secondary,
    marginBottom: 2,
  },
  jAiBody: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  jColTitle: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 7,
    color: Theme.colors.textMuted,
  },
  jColBody: {
    fontFamily: Theme.fonts.body,
    fontSize: 10,
    color: Theme.colors.onSurfaceVariant,
    lineHeight: 14,
  },
  chatList: {
    gap: 8,
  },
  chatCard: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  chatCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatSessionId: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.radius.full,
  },
  riskText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 8,
  },
  chatSummary: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.onSurface,
    lineHeight: 15,
  },
  noData: {
    fontFamily: Theme.fonts.body,
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  downloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF6F5', // Soft primary container color
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: '#2E6E6530',
    gap: Theme.spacing.xs,
  },
  downloadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  downloadIconBox: {
    width: 44,
    height: 44,
    borderRadius: Theme.radius.lg,
    backgroundColor: '#0D564D10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 15,
    color: Theme.colors.primary,
  },
  downloadDesc: {
    fontFamily: Theme.fonts.body,
    fontSize: 11,
    color: Theme.colors.textMuted,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    height: 40,
    borderRadius: Theme.radius.lg,
    paddingHorizontal: 16,
    gap: 6,
  },
  downloadBtnText: {
    fontFamily: Theme.fonts.headline,
    fontSize: 12,
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.md,
    width: '80%',
    maxHeight: '60%',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontFamily: Theme.fonts.headline,
    fontSize: 16,
    color: Theme.colors.onSurface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
    paddingBottom: 6,
  },
  modalItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceLow,
  },
  modalItemText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.onSurface,
  },
  modalCloseBtn: {
    marginTop: 4,
    height: 40,
    backgroundColor: Theme.colors.surfaceLow,
    borderRadius: Theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontFamily: Theme.fonts.bodyBold,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
  },
});

export default ReportsScreen;
