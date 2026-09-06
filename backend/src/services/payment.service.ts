import Razorpay from "razorpay";
import crypto from "crypto";
import { AppError } from "@/lib/app-error";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

interface CreateOrderParams {
  amount: number | string | null;
  bookingId: string;
  userEmail?: string | null;
  userName?: string | null;
}

interface CreatePaymentLinkParams {
  amount: number | string | null;
  bookingId: string;
  userName?: string | null;
  userContact?: string | null;
  userEmail?: string | null;
  callbackUrl?: string;
}

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  [key: string]: any;
}

export class PaymentService {
  /**
   * Create a Razorpay order for a booking
   */
  static async createOrder({
    amount,
    bookingId,
    userEmail,
    userName,
  }: CreateOrderParams) {
    try {
      const numAmount =
        typeof amount === "string" ? parseFloat(amount) : amount || 0;
      const order: RazorpayOrderResponse = (await razorpay.orders.create({
        amount: Math.round(numAmount * 100), // Convert to paise
        currency: "INR",
        receipt: `booking_${bookingId}`,
        notes: {
          bookingId,
          userEmail: userEmail || "",
          userName: userName || "",
        },
      })) as RazorpayOrderResponse;

      return {
        orderId: order.id,
        amount: (order.amount || 0) / 100, // Convert back to rupees
        currency: order.currency,
        receipt: order.receipt,
      };
    } catch (error) {
      console.error("Razorpay order creation failed:", error);
      throw new AppError("Failed to create payment order", 400);
    }
  }

  /**
   * Create a Razorpay Payment Link for a booking.
   * Returns a short_url (hosted on razorpay.com) that works in mobile in-app browsers.
   */
  static async createPaymentLink({
    amount,
    bookingId,
    userName,
    userContact,
    userEmail,
    callbackUrl,
  }: CreatePaymentLinkParams) {
    try {
      const numAmount =
        typeof amount === "string" ? parseFloat(amount) : amount || 0;

      let contact = userContact;
      let email = userEmail;
      if (!contact && !email) {
        email = "customer@mymindtherapyfriend.com";
      }

      const linkPayload: any = {
        amount: Math.round(numAmount * 100), // paise
        currency: "INR",
        description: "Therapy Session – MyMindTherapyFriend",
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { bookingId },
      };

      if (contact || email) {
        linkPayload.customer = {};
        if (userName) linkPayload.customer.name = userName;
        if (contact) linkPayload.customer.contact = contact;
        if (email) linkPayload.customer.email = email;
      }

      if (callbackUrl) {
        linkPayload.callback_url = callbackUrl;
        linkPayload.callback_method = "get";
      }

      const link = await (razorpay as any).paymentLink.create(linkPayload);

      return {
        paymentLinkId: link.id as string,
        shortUrl: link.short_url as string,
      };
    } catch (error: any) {
      console.error("Razorpay payment link creation failed:", error);
      const errMsg = error.error?.description || error.message || error.description || JSON.stringify(error);
      throw new AppError(`Failed to create payment link: ${errMsg}`, 400);
    }
  }

  /**
   * Verify payment signature from Razorpay webhook
   */
  static verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    return expectedSignature === signature;
  }

  /**
   * Fetch payment details from Razorpay
   */
  static async getPaymentDetails(paymentId: string) {
    try {
      const payment = await razorpay.payments.fetch(paymentId);
      const paymentAmount =
        typeof payment.amount === "number" ? payment.amount : 0;
      return {
        id: payment.id,
        amount: paymentAmount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        notes: payment.notes,
      };
    } catch (error: any) {
      console.error("Failed to fetch payment details:", error);
      const errMsg = error?.error?.description || error?.message || "Failed to fetch payment details from Razorpay";
      throw new AppError(errMsg, 400);
    }
  }

  /**
   * Refund a payment
   */
  static async refundPayment(paymentId: string, amount?: number) {
    try {
      const refund = await razorpay.payments.refund(paymentId, {
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return {
        refundId: refund.id,
        paymentId: refund.payment_id,
        amount: (refund.amount || 0) / 100,
        status: refund.status,
        notes: refund.notes,
      };
    } catch (error) {
      console.error("Refund failed:", error);
      throw new Error("Failed to process refund");
    }
  }

  /**
   * Fetch payments made for a given Razorpay Order ID
   */
  static async fetchOrderPayments(orderId: string) {
    try {
      const response = await razorpay.orders.fetchPayments(orderId);
      return response.items || [];
    } catch (error) {
      console.error(`Failed to fetch payments for order ${orderId}:`, error);
      return [];
    }
  }

  /**
   * Check if a Razorpay Order is paid
   */
  static async isOrderPaid(orderId: string): Promise<{ isPaid: boolean; paymentId?: string }> {
    try {
      const order = await razorpay.orders.fetch(orderId);
      if (order.status === "paid") {
        const payments = await this.fetchOrderPayments(orderId);
        const captured = payments.find((p: any) => p.status === "captured" || p.status === "authorized");
        return { isPaid: true, paymentId: captured?.id };
      }
      const payments = await this.fetchOrderPayments(orderId);
      const captured = payments.find((p: any) => p.status === "captured" || p.status === "authorized");
      if (captured) {
        return { isPaid: true, paymentId: captured.id };
      }
      return { isPaid: false };
    } catch (error) {
      console.error(`Failed to check if order ${orderId} is paid:`, error);
      return { isPaid: false };
    }
  }
}

export default PaymentService;

