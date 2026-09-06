import type { Response } from "express";
import { asyncHandler } from "@/lib/async-handler";
import type { AuthedRequest } from "@/middleware/auth";
import { SubscriptionPlan } from "@/models";

export class PlanController {
  
  /** GET /plans — Fetch all active plans (can optionally filter by audience) */
  static getPlans = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { audience } = req.query;
    
    const query: any = { isActive: true };
    if (audience) {
      query.audience = audience;
    }

    const plans = await SubscriptionPlan.find(query).sort({ price: 1 }).lean();
    res.json({ plans });
  });

  /** POST /admin/plans — Create a new plan */
  static createPlan = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { name, price, features, audience, config, durationMonths, password } = req.body;

    if (password !== process.env.SUPER_ADMIN_ACTION_PASSWORD) {
      return res.status(401).json({ error: "Invalid admin password" });
    }

    if (!name || price === undefined || price === null || !audience) {
      return res.status(400).json({ error: "Missing required fields (name, price, audience)" });
    }

    const parsedPrice = Number(price);
    if (isNaN(parsedPrice)) {
      return res.status(400).json({ error: "Price must be a valid number" });
    }

    const parsedDuration = (durationMonths !== undefined && durationMonths !== null && durationMonths !== "") ? Number(durationMonths) : 1;
    const finalDuration = (isNaN(parsedDuration) || parsedDuration < 1) ? 1 : Math.round(parsedDuration);

    console.log("[CreatePlan] Incoming req.body:", req.body);
    console.log("[CreatePlan] Parsed durationMonths:", finalDuration);

    const plan = new SubscriptionPlan({
      name,
      price: parsedPrice,
      features: features || [],
      audience,
      durationMonths: finalDuration,
      config: config || {
        dailyChatLimit: 300,
        hasPriorityBooking: false,
        therapistDiscount: 0,
        hasUnlimitedJournal: false
      },
      isActive: true
    });

    await plan.save();
    console.log("[CreatePlan] Saved plan document:", plan);
    res.status(201).json({ plan, message: "Plan created successfully" });
  });

  /** PUT /admin/plans/:id — Update an existing plan */
  static updatePlan = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { name, price, features, audience, config, durationMonths, isActive, password } = req.body;

    console.log("[UpdatePlan] Incoming req.body:", req.body);

    if (password !== process.env.SUPER_ADMIN_ACTION_PASSWORD) {
      return res.status(401).json({ error: "Invalid admin password" });
    }

    const parsedPrice = (price !== undefined && price !== null) ? Number(price) : undefined;
    const parsedDuration = (durationMonths !== undefined && durationMonths !== null && durationMonths !== "") ? Number(durationMonths) : undefined;

    const updateFields: any = {};
    if (name) updateFields.name = name;
    if (parsedPrice !== undefined && !isNaN(parsedPrice)) updateFields.price = parsedPrice;
    if (features) updateFields.features = features;
    if (audience) updateFields.audience = audience;
    if (config) updateFields.config = config;
    if (parsedDuration !== undefined && !isNaN(parsedDuration) && parsedDuration >= 1) updateFields.durationMonths = Math.round(parsedDuration);
    if (typeof isActive === 'boolean') updateFields.isActive = isActive;

    console.log("[UpdatePlan] updateFields object:", updateFields);

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    );

    console.log("[UpdatePlan] Updated plan document from DB:", plan);

    if (!plan) return res.status(404).json({ error: "Plan not found" });

    res.json({ plan, message: "Plan updated successfully" });
  });

  /** DELETE /admin/plans/:id — Soft delete a plan */
  static deletePlan = asyncHandler(async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { password } = req.body;

    if (password !== process.env.SUPER_ADMIN_ACTION_PASSWORD) {
      return res.status(401).json({ error: "Invalid admin password" });
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    res.json({ message: "Plan marked as inactive" });
  });
}
