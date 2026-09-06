import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import {
  Organization,
  User,
  Mood,
  Conversation,
  TherapistBooking,
  JournalEntry,
  TherapistInvitation,
} from "@/models";
import * as XLSX from "xlsx";

export class OrgController {
  static me = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const user = await User.findById(req.user!.sub);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.orgId) {
      return res.status(404).json({ error: "Organization not found for user" });
    }

    const org = await Organization.findById(user.orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    res.json({ organization: org });
  });

  /** GET /org/verified — Get all verified organizations (publicly usable for dropdowns) */
  static getVerifiedOrgs = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const orgs = await Organization.find({ verificationStatus: "verified" })
        .select("name type _id")
        .lean();
      res.json({ organizations: orgs });
    },
  );

  static onboarding = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const {
        name,
        type,
        officialEmail,
        contactPerson,
        phone,
        address,
        website,
        registrationUrl,
        accreditationUrl,
        governmentIdUrl,
        coverMemberTherapyFees,
      } = req.body;

      const user = await User.findById(req.user!.sub);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Idempotency/refresh guard:
      // If the user already has an org (pending or verified), do not re-create org + role.
      if (user.orgId) {
        const existingOrg = await Organization.findById(user.orgId).lean();
        if (
          existingOrg &&
          (existingOrg.verificationStatus === "pending" ||
            existingOrg.verificationStatus === "verified")
        ) {
          // Ensure role is consistent
          if (user.role !== "org_admin") {
            user.role = "org_admin";
            await user.save();
          }

          return res.json({
            message: "Organization already submitted. Please wait for review.",
            org: existingOrg,
            idempotent: true,
          });
        }
      }

      // Create the organization
      const org = new Organization({
        name,
        type: type || "college",
        officialEmail,
        contactPerson,
        phone,
        address,
        website,
        verificationStatus: "pending",
        documents: {
          registrationUrl,
          accreditationUrl,
          governmentIdUrl,
        },
        seats: 0,
        contract: {
          start: new Date(),
          end: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year default
          pepm: 0,
        },
        departments: [],
        allowedEmails: [],
        pendingJoinRequests: [],
        coverMemberTherapyFees: typeof coverMemberTherapyFees === "boolean" ? coverMemberTherapyFees : false,
      });

      await org.save();

      // Link user to org and set role to org_admin
      user.orgId = org._id as any;
      user.role = "org_admin";
      await user.save();

      res.json({
        message: "Organization submitted for review successfully",
        org,
      });
    },
  );

  /** PATCH /org/settings — Org Admin updates organization settings (such as therapy fee coverage) */
  static updateSettings = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const user = await User.findById(req.user!.sub);
      if (!user || !user.orgId) {
        return res
          .status(403)
          .json({ error: "Not associated with an organization" });
      }

      const { coverMemberTherapyFees, allowExternalTherapists } = req.body;
      const updateData: any = {};
      if (typeof coverMemberTherapyFees === "boolean") {
        updateData.coverMemberTherapyFees = coverMemberTherapyFees;
      }
      if (typeof allowExternalTherapists === "boolean") {
        updateData.allowExternalTherapists = allowExternalTherapists;
      }

      const org = await Organization.findByIdAndUpdate(user.orgId, updateData, { new: true });
      if (!org) return res.status(404).json({ error: "Organization not found" });

      res.json({ message: "Organization settings updated successfully", organization: org });
    },
  );

  /** GET /org/pending-therapists — Get pending therapists for this organization */
  static pendingTherapists = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const user = await User.findById(req.user!.sub);
      if (!user || !user.orgId)
        return res
          .status(403)
          .json({ error: "Not associated with an organization" });

      const therapists = await User.find({
        role: "therapist",
        orgId: user.orgId,
        "therapistProfile.verificationStatus": "pending",
      }).lean();

      res.json({
        therapists: therapists.map((t) => ({
          id: t._id,
          name: t.therapistProfile?.name || (t as any).username,
          email: (t as any).email,
          qualification: t.therapistProfile?.qualification,
          specializations: t.therapistProfile?.specializations,
          experienceYears: t.therapistProfile?.experienceYears,
          clinicDetails: t.therapistProfile?.clinicDetails,
          documents: t.therapistProfile?.documents,
          introVideoUrl: t.therapistProfile?.introVideoUrl,
          createdAt: t.createdAt,
        })),
      });
    },
  );

  /** PATCH /org/therapist/:id/verify — Org Admin verifies a therapist */
  static verifyTherapist = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const user = await User.findById(req.user!.sub).lean();
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const { id } = req.params;
      const { verified } = req.body;

      const therapist = await User.findOne({
        _id: id,
        orgId: user.orgId,
        role: "therapist",
      });
      if (!therapist) {
        return res.status(404).json({
          error: "Therapist not found or not part of this organization",
        });
      }

      if (!therapist.therapistProfile) {
        return res
          .status(400)
          .json({ error: "Therapist profile not initialized" });
      }

      therapist.therapistProfile.verified = verified;
      therapist.therapistProfile.verificationStatus = verified
        ? "verified"
        : "rejected";
      await therapist.save();

      res.json({ ok: true });
    },
  );

  /** GET /org/stats — aggregates for the Org Dashboard */
  static dashboardStats = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const user = await User.findById(req.user!.sub).lean();
      if (!user || !user.orgId)
        return res.status(403).json({ error: "Organization access required" });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // 1. Get all users in this org
      const orgUsers = await User.find({
        orgId: user.orgId,
        role: "user",
        deletedAt: null,
      })
        .select("_id department lastActiveAt")
        .lean();
      const userIds = orgUsers.map((u) => u._id);

      // 2. Active users (active in last 30 days)
      const activeUsers = orgUsers.filter(
        (u) => u.lastActiveAt && u.lastActiveAt >= thirtyDaysAgo,
      ).length;

      // 3. Department aggregations
      // Default fallback to "General" if no department
      const deptsMap = new Map<
        string,
        {
          members: number;
          moodSum: number;
          moodCount: number;
          sessions: number;
        }
      >();
      orgUsers.forEach((u) => {
        const d = u.department || "General";
        if (!deptsMap.has(d))
          deptsMap.set(d, {
            members: 0,
            moodSum: 0,
            moodCount: 0,
            sessions: 0,
          });
        deptsMap.get(d)!.members += 1;
      });

      // Moods in the org
      const moods = await Mood.find({
        userId: { $in: userIds },
        createdAt: { $gte: thirtyDaysAgo },
      })
        .populate("userId", "department")
        .lean();
      moods.forEach((m) => {
        const u = m.userId as any;
        const d = u?.department || "General";
        if (deptsMap.has(d)) {
          deptsMap.get(d)!.moodSum += m.score;
          deptsMap.get(d)!.moodCount += 1;
        }
      });

      // Bookings/Sessions in the org
      const bookings = await TherapistBooking.find({
        userId: { $in: userIds },
        createdAt: { $gte: thirtyDaysAgo },
      })
        .populate("userId", "department")
        .lean();
      bookings.forEach((b) => {
        const u = b.userId as any;
        const d = u?.department || "General";
        if (deptsMap.has(d)) deptsMap.get(d)!.sessions += 1;
      });

      // Build DEPARTMENTS array
      const DEPARTMENTS = Array.from(deptsMap.entries()).map(
        ([name, data]) => ({
          id: `dept_${name}`,
          name,
          members: data.members,
          avgMood:
            data.moodCount > 0
              ? parseFloat((data.moodSum / data.moodCount).toFixed(1))
              : 0,
          sessions: data.sessions,
          burnoutRisk:
            data.moodCount > 0 && data.moodSum / data.moodCount < 5.0,
        }),
      );

      // 4. Organization-wide Mood Trend (last 30 days)
      const moodTrendMap = new Map<string, { sum: number; count: number }>();
      moods.forEach((m) => {
        const dateStr = new Date(m.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        if (!moodTrendMap.has(dateStr))
          moodTrendMap.set(dateStr, { sum: 0, count: 0 });
        moodTrendMap.get(dateStr)!.sum += m.score;
        moodTrendMap.get(dateStr)!.count += 1;
      });

      const MOOD_DATA = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric" },
        );
        MOOD_DATA.push({
          date: d,
          mood: moodTrendMap.has(d)
            ? parseFloat(
                (moodTrendMap.get(d)!.sum / moodTrendMap.get(d)!.count).toFixed(
                  1,
                ),
              )
            : null,
        });
      }

      // 5. Overall metrics
      const totalMoodCount = moods.length;
      const avgTeamMood =
        totalMoodCount > 0
          ? (
              moods.reduce((sum, m) => sum + m.score, 0) / totalMoodCount
            ).toFixed(1)
          : "0.0";
      const engagement =
        orgUsers.length > 0
          ? Math.round((activeUsers / orgUsers.length) * 100)
          : 0;

      // Anonymised Crisis Alerts
      const crisisAlerts = moods.filter((m) => m.score <= 3).length;

      res.json({
        metrics: {
          activeUsers,
          totalUsers: orgUsers.length,
          avgTeamMood,
          engagement,
          crisisAlerts,
        },
        departments: DEPARTMENTS,
        moodTrend: MOOD_DATA,
      });
    },
  );

  /** GET /org/users — list employees in the organization */
  static listUsers = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const user = await User.findById(req.user!.sub).lean();
    if (!user || !user.orgId)
      return res.status(403).json({ error: "Organization access required" });

    const users = await User.find({
      orgId: user.orgId,
      role: "user",
      deletedAt: null,
    })
      .select("fullName email department lastActiveAt clerkId phoneMasked")
      .lean();

    res.json({
      users: users.map((u) => ({
        id: u._id,
        name: u.fullName || "Unnamed User",
        email: u.phoneMasked, // using masked phone since we don't have email in this schema
        dept: u.department || "General",
        status:
          u.lastActiveAt &&
          u.lastActiveAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            ? "Active"
            : "Inactive",
      })),
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW: JOIN REQUEST FLOW
  // ─────────────────────────────────────────────────────────────────────────────

  /** POST /org/request-join — Regular user requests to link with an org */
  static requestJoin = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const { orgId, email: providedEmail } = req.body;
      if (!orgId) return res.status(400).json({ error: "orgId is required" });

      const user = await User.findById(req.user!.sub);
      if (!user) return res.status(404).json({ error: "User not found" });

      const org = await Organization.findById(orgId);
      if (!org)
        return res.status(404).json({ error: "Organization not found" });
      if (org.verificationStatus !== "verified") {
        return res
          .status(400)
          .json({ error: "Organization is not yet verified on MyMindTherapyFriend" });
      }

      // Check if already submitted a request
      const existing = org.pendingJoinRequests.find(
        (r) => r.userId.toString() === (user._id as any).toString(),
      );
      if (existing) {
        return res.json({
          message: "Join request already submitted",
          status: existing.status,
        });
      }

      // Determine auto-approval: check if user's Clerk email, phoneMasked, or PROVIDED email is in allowedEmails
      const userEmail = (user as any).email?.toLowerCase() || "";
      const compareEmail = providedEmail?.toLowerCase() || userEmail;

      const isAutoApproved =
        org.allowedEmails.length > 0 &&
        (org.allowedEmails.includes(compareEmail) ||
          org.allowedEmails.includes(user.phoneMasked?.toLowerCase() || ""));

      const joinRequest = {
        userId: user._id as any,
        email: providedEmail || userEmail || undefined,
        phoneMasked: user.phoneMasked,
        fullName: user.fullName,
        status: isAutoApproved ? ("approved" as const) : ("pending" as const),
        autoApproved: isAutoApproved,
        requestedAt: new Date(),
      };

      org.pendingJoinRequests.push(joinRequest as any);
      await org.save();

      // If auto-approved, link user to org immediately
      if (isAutoApproved) {
        user.orgId = org._id as any;
        await user.save();
        return res.json({
          message:
            "You have been automatically approved based on your organisation email!",
          status: "approved",
          autoApproved: true,
        });
      }

      res.json({
        message:
          "Join request submitted. Your organisation admin will review and approve.",
        status: "pending",
        autoApproved: false,
      });
    },
  );

  /** GET /org/join-requests — Org admin views all pending join requests */
  static listJoinRequests = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const user = await User.findById(req.user!.sub).lean();
      if (!user || !user.orgId)
        return res.status(403).json({ error: "Organization access required" });

      const org = await Organization.findById(user.orgId).lean();
      if (!org)
        return res.status(404).json({ error: "Organization not found" });

      res.json({ joinRequests: org.pendingJoinRequests });
    },
  );

  /** PATCH /org/join-request/:userId/approve — Org admin approves a user */
  static approveJoinRequest = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const adminUser = await User.findById(req.user!.sub).lean();
      if (!adminUser || !adminUser.orgId)
        return res.status(403).json({ error: "Organization access required" });

      const { userId } = req.params;
      const org = await Organization.findById(adminUser.orgId);
      if (!org)
        return res.status(404).json({ error: "Organization not found" });

      const reqEntry = org.pendingJoinRequests.find(
        (r) => r.userId.toString() === userId,
      );
      if (!reqEntry)
        return res.status(404).json({ error: "Join request not found" });

      reqEntry.status = "approved";
      await org.save();

      // Link user to org
      const targetUser = await User.findById(userId);
      if (targetUser) {
        targetUser.orgId = org._id as any;
        await targetUser.save();
      }

      res.json({
        ok: true,
        message: "User approved and linked to organisation",
      });
    },
  );

  /** PATCH /org/join-request/:userId/reject — Org admin rejects a user */
  static rejectJoinRequest = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const adminUser = await User.findById(req.user!.sub).lean();
      if (!adminUser || !adminUser.orgId)
        return res.status(403).json({ error: "Organization access required" });

      const { userId } = req.params;
      const org = await Organization.findById(adminUser.orgId);
      if (!org)
        return res.status(404).json({ error: "Organization not found" });

      const reqEntry = org.pendingJoinRequests.find(
        (r) => r.userId.toString() === userId,
      );
      if (!reqEntry)
        return res.status(404).json({ error: "Join request not found" });

      reqEntry.status = "rejected";
      await org.save();

      res.json({ ok: true, message: "Join request rejected" });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW: EXCEL EMAIL WHITELIST UPLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  /** POST /org/upload-emails — Org admin uploads Excel sheet to extract employee emails */
  static uploadEmails = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const adminUser = await User.findById(req.user!.sub).lean();
      if (!adminUser || !adminUser.orgId)
        return res.status(403).json({ error: "Organization access required" });

      const file = (req as any).file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      // Parse Excel workbook from buffer
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const emails: string[] = [];

      // Email regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
        });

        for (const row of rows) {
          for (const cell of row) {
            if (typeof cell === "string" && emailRegex.test(cell.trim())) {
              emails.push(cell.trim().toLowerCase());
            }
          }
        }
      }

      const uniqueEmails = [...new Set(emails)];

      if (uniqueEmails.length === 0) {
        return res.status(400).json({
          error: "No valid email addresses found in the uploaded file",
        });
      }

      // Update org's allowed emails (merge, no duplicates)
      const org = await Organization.findById(adminUser.orgId);
      if (!org)
        return res.status(404).json({ error: "Organization not found" });

      const newEmails = uniqueEmails.filter(email => !org.allowedEmails.includes(email));

      const merged = [...new Set([...org.allowedEmails, ...uniqueEmails])];
      org.allowedEmails = merged;
      await org.save();

      // Trigger invitation emails in the background
      if (newEmails.length > 0) {
        import("@/lib/mail").then(({ sendInviteEmail }) => {
          const origin = req.headers.origin;
          Promise.all(newEmails.map(email => sendInviteEmail(email, org.name, origin)))
            .catch(err => console.error("Error sending bulk invite emails:", err));
        }).catch(err => console.error("Error loading mail module:", err));
      }

      // Auto-approve any pending join requests that now match
      const autoApproved: string[] = [];
      for (const jr of org.pendingJoinRequests) {
        if (jr.status === "pending") {
          const email = jr.email?.toLowerCase() || "";
          const phone = jr.phoneMasked?.toLowerCase() || "";
          if (uniqueEmails.includes(email) || uniqueEmails.includes(phone)) {
            jr.status = "approved";
            jr.autoApproved = true;
            autoApproved.push(jr.userId.toString());
          }
        }
      }
      await org.save();

      // Link any auto-approved users
      if (autoApproved.length > 0) {
        await User.updateMany(
          { _id: { $in: autoApproved } },
          { $set: { orgId: org._id } },
        );
      }

      res.json({
        message: `Successfully extracted ${uniqueEmails.length} emails. ${autoApproved.length} pending requests auto-approved.`,
        emailsExtracted: uniqueEmails.length,
        autoApprovedCount: autoApproved.length,
        totalAllowedEmails: merged.length,
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW: PER-USER DATA FOR ORG ADMIN
  // ─────────────────────────────────────────────────────────────────────────────

  /** GET /org/user-data/:userId — Org admin views a member's wellness data */
  static getUserData = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const adminUser = await User.findById(req.user!.sub).lean();
      if (!adminUser || !adminUser.orgId)
        return res.status(403).json({ error: "Organization access required" });

      const { userId } = req.params;

      // Verify this user belongs to the admin's org
      const targetUser = await User.findOne({
        _id: userId,
        orgId: adminUser.orgId,
        role: { $in: ["user", "therapist"] },
        deletedAt: null,
      })
        .select("fullName phoneMasked department lastActiveAt createdAt")
        .lean();

      if (!targetUser)
        return res
          .status(404)
          .json({ error: "User not found in this organization" });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Mood history (last 30 entries)
      const moods = await Mood.find({ userId })
        .sort({ createdAt: -1 })
        .limit(30)
        .select("score note createdAt")
        .lean();

      // Session/booking count
      const sessionCount = await TherapistBooking.countDocuments({ userId });
      const recentSessions = await TherapistBooking.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("status createdAt slot")
        .lean();

      // Journal entry count
      const journalCount = await JournalEntry.countDocuments({ userId });

      // Average mood (last 30 days)
      const recentMoods = moods.filter(
        (m) => new Date(m.createdAt) >= thirtyDaysAgo,
      );
      const avgMood =
        recentMoods.length > 0
          ? parseFloat(
              (
                recentMoods.reduce((s, m) => s + m.score, 0) /
                recentMoods.length
              ).toFixed(1),
            )
          : null;

      res.json({
        user: {
          id: targetUser._id,
          name: targetUser.fullName || "Unnamed User",
          phoneMasked: targetUser.phoneMasked,
          department: targetUser.department || "General",
          joinedAt: targetUser.createdAt,
          lastActiveAt: targetUser.lastActiveAt,
        },
        wellness: {
          avgMood,
          moodHistory: moods.reverse(), // chronological order
          sessionCount,
          recentSessions,
          journalCount,
        },
      });
    },
  );

  /** GET /org/members — Org admin lists all approved/linked members */
  static listMembers = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const adminUser = await User.findById(req.user!.sub).lean();
      if (!adminUser || !adminUser.orgId)
        return res.status(403).json({ error: "Organization access required" });

      const org = await Organization.findById(adminUser.orgId).lean();
      if (!org)
        return res.status(404).json({ error: "Organization not found" });

      // Members = users with this orgId + approved join request
      const approvedUserIds = org.pendingJoinRequests
        .filter((r) => r.status === "approved")
        .map((r) => r.userId);

      const members = await User.find({
        _id: { $in: approvedUserIds },
        role: { $in: ["user", "therapist"] },
        deletedAt: null,
      })
        .select("fullName phoneMasked department lastActiveAt createdAt")
        .lean();

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const mappedUsers = members.map((m) => {
        const jr = org.pendingJoinRequests.find(
          (r) => r.userId.toString() === (m._id as any).toString(),
        );
        return {
          id: m._id,
          name: m.fullName || "Unnamed User",
          phoneMasked: m.phoneMasked,
          email: jr?.email || null,
          department: m.department || "General",
          autoApproved: jr?.autoApproved || false,
          approvedAt: jr?.requestedAt,
          status:
            m.lastActiveAt && m.lastActiveAt >= thirtyDaysAgo
              ? "Active"
              : "Inactive",
          role: "user",
        };
      });

      // Also fetch verified therapists
      const therapists = await User.find({
        orgId: adminUser.orgId,
        role: "therapist",
        "therapistProfile.verificationStatus": "verified",
        deletedAt: null,
      })
        .select("fullName email phoneMasked lastActiveAt createdAt")
        .lean();

      const mappedTherapists = therapists.map((t: any) => ({
        id: t._id,
        name: t.fullName || "Unnamed Therapist",
        phoneMasked: t.phoneMasked,
        email: t.email || null,
        department: "Therapist",
        autoApproved: false,
        approvedAt: t.createdAt,
        status:
          t.lastActiveAt && t.lastActiveAt >= thirtyDaysAgo
            ? "Active"
            : "Inactive",
        role: "therapist",
      }));

      res.json({
        members: [...mappedUsers, ...mappedTherapists],
      });
    },
  );

  /** POST /org/invite-therapist — Org admin invites an independent therapist */
  static inviteTherapist = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const user = await User.findById(req.user!.sub).lean();
    if (!user || !user.orgId) return res.status(403).json({ error: "Org access required" });

    const org = await Organization.findById(user.orgId);
    if (!org) return res.status(404).json({ error: "Org not found" });

    if (!org.allowExternalTherapists) {
      return res.status(403).json({ error: "External therapist invitations are not allowed for this organization" });
    }

    const { therapistId } = req.body;
    if (!therapistId) return res.status(400).json({ error: "therapistId is required" });

    const therapist = await User.findOne({ _id: therapistId, role: "therapist", deletedAt: null });
    if (!therapist) return res.status(404).json({ error: "Therapist not found" });

    if (therapist.orgId) {
      return res.status(400).json({ error: "Therapist is already part of an organization" });
    }

    // Check if invitation already exists
    const existing = await TherapistInvitation.findOne({
      orgId: org._id,
      therapistId,
      status: "pending"
    });
    if (existing) return res.status(400).json({ error: "Invitation already pending" });

    const invitation = new TherapistInvitation({
      orgId: org._id,
      therapistId,
      status: "pending"
    });
    await invitation.save();

    res.json({ message: "Invitation sent successfully", invitation });
  });

  /** GET /org/invitations — Org admin lists sent invitations */
  static listInvitations = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const user = await User.findById(req.user!.sub).lean();
    if (!user || !user.orgId) return res.status(403).json({ error: "Org access required" });

    const invitations = await TherapistInvitation.find({ orgId: user.orgId })
      .populate("therapistId", "fullName therapistProfile")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ invitations });
  });

  /** DELETE /org/invitation/:id — Org admin cancels an invitation */
  static cancelInvitation = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const user = await User.findById(req.user!.sub).lean();
    if (!user || !user.orgId) return res.status(403).json({ error: "Org access required" });

    const { id } = req.params;
    const invitation = await TherapistInvitation.findOneAndDelete({
      _id: id,
      orgId: user.orgId,
      status: "pending"
    });

    if (!invitation) return res.status(404).json({ error: "Pending invitation not found" });

    res.json({ message: "Invitation cancelled" });
  });

  /** DELETE /org/therapist/:id — Org admin removes an external/attached therapist from organization */
  static removeTherapistFromOrg = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const adminUser = await User.findById(req.user!.sub).lean();
    if (!adminUser || !adminUser.orgId) return res.status(403).json({ error: "Org access required" });

    const { id } = req.params;
    const therapist = await User.findOne({ _id: id, role: "therapist", orgId: adminUser.orgId });
    if (!therapist) return res.status(404).json({ error: "Therapist not found in this organization" });

    therapist.orgId = undefined;
    await therapist.save();

    await TherapistInvitation.updateMany(
      { orgId: adminUser.orgId, therapistId: id },
      { status: "rejected" }
    );

    res.json({ message: "Therapist removed from organization successfully" });
  });

  /** POST /org/whitelist-email — Org admin manually adds an employee email to whitelist */
  static whitelistEmail = asyncHandler(
    async (req: AuthedRequest, res: Response) => {
      const adminUser = await User.findById(req.user!.sub).lean();
      if (!adminUser || !adminUser.orgId)
        return res.status(403).json({ error: "Organization access required" });

      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "A valid email address is required" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const org = await Organization.findById(adminUser.orgId);
      if (!org)
        return res.status(404).json({ error: "Organization not found" });

      if (org.allowedEmails.includes(normalizedEmail)) {
        return res.status(400).json({ error: "Email is already whitelisted" });
      }

      org.allowedEmails.push(normalizedEmail);
      
      // Auto-approve any pending join request matching this email
      let autoApproved = false;
      const targetUserId: string[] = [];
      for (const jr of org.pendingJoinRequests) {
        if (jr.status === "pending" && jr.email?.toLowerCase() === normalizedEmail) {
          jr.status = "approved";
          jr.autoApproved = true;
          autoApproved = true;
          targetUserId.push(jr.userId.toString());
        }
      }
      await org.save();

      if (autoApproved && targetUserId.length > 0) {
        await User.updateMany(
          { _id: { $in: targetUserId } },
          { $set: { orgId: org._id } },
        );
      }

      // Send invite email
      try {
        const { sendInviteEmail } = await import("@/lib/mail");
        await sendInviteEmail(normalizedEmail, org.name, req.headers.origin);
      } catch (err) {
        console.error("Error sending invite email:", err);
      }

      res.json({
        message: autoApproved 
          ? `Successfully whitelisted ${normalizedEmail}. Pending request auto-approved.` 
          : `Successfully whitelisted ${normalizedEmail} and sent invitation.`,
        email: normalizedEmail,
        autoApproved,
      });
    }
  );
}

