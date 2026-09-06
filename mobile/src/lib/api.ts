/**
 * api.ts — Mobile API client (React Native)
 * Uses Clerk session token in Authorization: Bearer header.
 * Call setTokenGetter(fn) once from ClerkProvider to inject the token getter.
 */

import { API_URL } from "./store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Token getter injected by Clerk hook wrapper
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Attach Clerk session token if available
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch (e) {
      console.warn("Failed to get Clerk JWT token:", e);
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "API Error" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

const API = {
  health: () => apiCall<{ ok: boolean }>("/api/health"),
  auth: {
    me: () => apiCall<any>("/api/auth/me"),
    setRole: async (role: string) => {
      // Try to include an x-intent-role header so backend can assign role at auto-provision time
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      try {
        const stashed = await AsyncStorage.getItem("intended_role");
        if (stashed) headers["x-intent-role"] = stashed;
      } catch (e) {
        // ignore
      }

      if (_getToken) {
        try {
          const token = await _getToken();
          if (token) headers["Authorization"] = `Bearer ${token}`;
        } catch (e) {
          // ignore token fetch errors here; apiCall will also attempt
        }
      }

      const response = await fetch(`${API_URL}/api/auth/role`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "API Error" }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    updateOnboarding: (data: any) =>
      apiCall<any>("/api/auth/onboarding", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    updateProfile: (data: any) =>
      apiCall<any>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    registerPushToken: (token: string) =>
      apiCall<any>("/api/auth/push-token", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    therapistOnboarding: (data: any) =>
      apiCall<any>("/api/auth/therapist/onboarding", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  admin: {
    pendingTherapists: () => apiCall<any>("/api/admin/therapists"),
    verifyTherapist: (
      id: string,
      data: { verified: boolean; password?: string },
    ) =>
      apiCall<any>(`/api/admin/therapist/${id}/verify`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    pendingOrgs: () => apiCall<any>("/api/admin/pending-orgs"),
    verifyOrg: (id: string, data: { verified: boolean; password?: string }) =>
      apiCall<any>(`/api/admin/org/${id}/verify`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    toggleExternalTherapists: (
      id: string,
      data: { allow: boolean; password?: string },
    ) =>
      apiCall<any>(`/api/admin/org/${id}/toggle-external-therapists`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    toggleCoverMemberTherapyFees: (
      id: string,
      data: { coverMemberTherapyFees: boolean; password?: string },
    ) =>
      apiCall<any>(`/api/admin/org/${id}/toggle-cover-therapy`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    createPlan: (data: any) =>
      apiCall<any>("/api/admin/plans", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updatePlan: (id: string, data: any) =>
      apiCall<any>(`/api/admin/plans/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deletePlan: (id: string, data: any) =>
      apiCall<any>(`/api/admin/plans/${id}`, {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
     stats: () => apiCall<any>("/api/admin/stats"),
    verify: (id: string) =>
      apiCall<any>(`/api/admin/verify/${id}`, { method: "PATCH" }),
    listUsersAndOrgs: () =>
      apiCall<any>("/api/admin/users-orgs").catch(() => ({ users: [], organizations: [] })),
    manualUpgrade: (data: any) =>
      apiCall<any>("/api/admin/manual-upgrade", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    platformCounts: () => apiCall<any>("/api/admin/platform-counts"),
    markTherapistPaid: (id: string, data: { amount: number; password?: string }) =>
      apiCall<any>(`/api/admin/therapist/${id}/mark-paid`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  org: {
    me: () => apiCall<any>("/api/org/me"),
    verifiedOrgs: () => apiCall<any>("/api/org/verified"),
    onboarding: (data: any) =>
      apiCall<any>("/api/org/onboarding", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateSettings: (data: { coverMemberTherapyFees?: boolean; allowExternalTherapists?: boolean }) =>
      apiCall<any>("/api/org/settings", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    pendingTherapists: () => apiCall<any>("/api/org/pending-therapists"),
    verifyTherapist: (id: string, data: { verified: boolean }) =>
      apiCall<any>(`/api/org/therapist/${id}/verify`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    requestJoin: (data: { orgId: string; email?: string }) =>
      apiCall<any>("/api/org/request-join", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    joinRequests: () => apiCall<any>("/api/org/join-requests"),
    approveJoinRequest: (userId: string) =>
      apiCall<any>(`/api/org/join-request/${userId}/approve`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    rejectJoinRequest: (userId: string) =>
      apiCall<any>(`/api/org/join-request/${userId}/reject`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    inviteTherapist: (data: { therapistId: string }) =>
      apiCall<any>("/api/org/invite-therapist", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    invitations: () => apiCall<any>("/api/org/invitations"),
    cancelInvitation: (id: string) =>
      apiCall<any>(`/api/org/invitation/${id}`, { method: "DELETE" }),
    uploadEmails: async (fileUri: string, fileName: string) => {
      const headers: Record<string, string> = {};
      if (_getToken) {
        const token = await _getToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }
      const formData = new FormData();
      // React Native FormData expects an object representation of the file
      formData.append("file", {
        uri: fileUri,
        name: fileName,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      } as any);

      const response = await fetch(`${API_URL}/api/org/upload-emails`, {
        method: "POST",
        headers,
        body: formData,
      });
      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      return response.json();
    },
    members: () => apiCall<any>("/api/org/members"),
    userDataForOrg: (userId: string) =>
      apiCall<any>(`/api/org/user-data/${userId}`),
    stats: () => apiCall<any>("/api/org/stats"),
    metrics: () => apiCall<any>("/api/org/metrics"),
    invite: (data: { email: string }) =>
      apiCall<any>("/api/org/whitelist-email", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  plan: {
    getAll: (audience?: string) =>
      apiCall<any>(`/api/plans${audience ? `?audience=${audience}` : ""}`),
  },

  user: {
    stats: () => apiCall<any>("/api/user/stats"),
    update: (data: any) =>
      apiCall<any>("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    profile: () => apiCall<any>("/api/user/profile"),
    getReport: (period: string) => apiCall<any>(`/api/user/report?period=${period}`),
    shareReport: (data: { therapistId: string; period: string; notes?: string }) =>
      apiCall<any>("/api/user/report/share", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    shares: () => apiCall<any>("/api/user/report/shares"),
  },

  therapist: {
    list: (query?: Record<string, any>) => {
      const params: string[] = [];
      if (query) {
        Object.entries(query).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            params.push(
              `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
            );
          }
        });
      }
      const queryStr = params.length > 0 ? `?${params.join("&")}` : "";
      return apiCall<any>(`/api/therapists${queryStr}`);
    },
    get: (id: string) => apiCall<any>(`/api/therapists/${id}`),
    availability: (id: string, query?: { date?: string }) => {
      const queryStr = query?.date
        ? `?date=${encodeURIComponent(query.date)}`
        : "";
      return apiCall<any>(`/api/therapists/${id}/availability${queryStr}`);
    },
    meStats: () => apiCall<any>("/api/therapists/me/stats"),
    stats: () => apiCall<any>("/api/therapists/me/stats"),
    meBookings: () => apiCall<any>("/api/therapists/me/bookings"),
    updateAvailability: (data: {
      availability: { day: number; slots: string[] }[];
    }) =>
      apiCall<any>("/api/therapists/me/availability", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    updateProfile: (data: any) =>
      apiCall<any>("/api/therapists/me/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    invitations: () => apiCall<any>("/api/therapists/me/invitations"),
    respondToInvitation: (
      id: string,
      data: { action: "accepted" | "rejected" },
    ) =>
      apiCall<any>(`/api/therapists/me/invitations/${id}/respond`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    sharedReports: () => apiCall<any>("/api/therapists/me/shared-reports"),
    sharedReportDetail: (id: string) => apiCall<any>(`/api/therapists/me/shared-reports/${id}`),
  },

  booking: {
    list: () => apiCall<any>("/api/bookings"),
    getUserBookings: () => apiCall<any>("/api/bookings"),
    create: (data: { therapistId: string; slot: string }) =>
      apiCall<any>("/api/bookings", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (id: string) => apiCall<any>(`/api/bookings/${id}`),
    cancel: (id: string) =>
      apiCall<any>(`/api/bookings/${id}/cancel`, { method: "DELETE" }),
    getVideoToken: (id: string) =>
      apiCall<any>(`/api/bookings/${id}/video-token`),
    rate: (id: string, data: { rating: number; feedback?: string }) =>
      apiCall<any>(`/api/bookings/${id}/rate`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getAiBrief: (id: string) => apiCall<any>(`/api/bookings/${id}/ai-brief`),
    savePrescription: (
      id: string,
      data: {
        medicines: {
          name: string;
          dosage: string;
          frequency: string;
          duration: string;
        }[];
        notes?: string;
      },
    ) =>
      apiCall<any>(`/api/bookings/${id}/prescription`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  payment: {
    initiate: (data: { bookingId: string }) =>
      apiCall<any>("/api/payment/initiate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    verify: (data: {
      bookingId: string;
      orderId: string;
      paymentId: string;
      signature: string;
    }) =>
      apiCall<any>("/api/payment/verify", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    demoVerify: (data: { bookingId: string }) =>
      apiCall<any>("/api/payment/demo-verify", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    status: (bookingId: string) => apiCall<any>(`/api/payment/${bookingId}`),
    getWalletBalance: () => apiCall<any>("/api/payment/wallet/balance"),
    addWalletFunds: (amount: number) =>
      apiCall<any>("/api/payment/wallet/add", { method: "POST", body: JSON.stringify({ amount }) }),
    payBookingWallet: (bookingId: string) =>
      apiCall<any>("/api/payment/wallet/pay-booking", { method: "POST", body: JSON.stringify({ bookingId }) }),
    payReportWallet: (data: { startDate: string; endDate: string }) =>
      apiCall<any>("/api/payment/report/initiate-wallet", { method: "POST", body: JSON.stringify(data) }),
  },

  chat: {
    sendMessage: async (data: {
      message: string;
    }): Promise<{ reply: string }> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (_getToken) {
        try {
          const token = await _getToken();
          if (token) headers["Authorization"] = `Bearer ${token}`;
        } catch (e) {
          console.warn("Failed to get Clerk JWT token:", e);
        }
      }
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...data, stream: false }),
      });


      if (!response.ok) {
        let errMessage = `HTTP ${response.status}`;
        try {
          const err = await response.json();
          errMessage = err.message || errMessage;
        } catch (e) {
          // If response is not JSON, try reading as text
          try {
            const txt = await response.text();
            if (txt && txt.length < 200) errMessage = txt;
          } catch (textErr) {}
        }
        throw new Error(errMessage);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          const parsed = await response.json();
          if (parsed.reply) {
            return { reply: parsed.reply };
          }
        } catch (jsonErr) {
          console.warn("Failed to parse standard JSON chat reply:", jsonErr);
        }
      }

      // Handle stream or text fallback
      const fullText = await response.text();
      let replyText = "";
      const lines = fullText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.substring(6).trim();
          if (jsonStr === '{"done":true}' || jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.chunk) {
              replyText += parsed.chunk;
            } else if (parsed.reply) {
              replyText = parsed.reply;
            }
          } catch (e) {
            // Ignore parse errors for partial or done event chunks
          }
        }
      }

      // Failsafe: if stream extraction didn't yield text, see if the raw response text is present and not HTML
      if (!replyText.trim() && fullText && !fullText.trim().startsWith("<")) {
        replyText = fullText.trim();
      }

      if (!replyText.trim()) {
        throw new Error("Empty companion response stream");
      }

      return { reply: replyText };
    },
    getMessages: () => apiCall<any>("/api/chat/history"),
  },

  mood: {
    list: () => apiCall<any>("/api/mood/history"),
    create: (data: any) =>
      apiCall<any>("/api/mood", { method: "POST", body: JSON.stringify(data) }),
    get: (id: string) => apiCall<any>(`/api/mood/${id}`),
  },

  journal: {
    list: () => apiCall<any>("/api/journal"),
    create: (data: any) =>
      apiCall<any>("/api/journal", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (id: string) => apiCall<any>(`/api/journal/${id}`),
    prompt: () => apiCall<any>("/api/journal/prompt"),
  },

  subscription: {
    get: () => apiCall<any>("/api/subscription"),
    upgrade: (data: { tier: string }) =>
      apiCall<any>("/api/subscription/upgrade", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    cancel: () => apiCall<any>("/api/subscription/cancel", { method: "POST" }),
    demoActivate: () =>
      apiCall<any>("/api/subscription/demo-activate", { method: "POST" }),
    sync: () => apiCall<any>("/api/subscription/sync", { method: "POST" }),
    admin: { all: () => apiCall<any>("/api/subscription/admin/all") },
  },

  notification: {
    list: () => apiCall<any>("/api/notifications"),
    markRead: (id: string) =>
      apiCall<any>(`/api/notifications/${id}/read`, { method: "PUT" }),
    markAllRead: () =>
      apiCall<any>("/api/notifications/read-all", { method: "PUT" }),
  },
};

export default API;
