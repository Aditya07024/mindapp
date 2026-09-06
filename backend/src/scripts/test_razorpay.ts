import dotenv from 'dotenv';
import Razorpay from 'razorpay';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

async function runTest() {
  console.log('Using Key ID:', process.env.RAZORPAY_KEY_ID);
  try {
    const payload = {
      amount: 2900, // ₹29 in paise
      currency: "INR",
      description: "Therapy Session – mymindtherapyfriend",
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { bookingId: "report_test" },
    };

    console.log('Sending payload:', payload);
    const link = await (razorpay as any).paymentLink.create(payload);
    console.log('SUCCESS:', link);
  } catch (err) {
    console.error('ERROR OCCURRED:', err);
  }
}

runTest();
