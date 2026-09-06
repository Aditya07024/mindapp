import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { User } from '../models';
import PaymentService from '../services/payment.service';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  try {
    const users = await User.find({});
    console.log(`Found ${users.length} users to test.`);

    for (const user of users) {
      console.log(`Testing user: ${user._id} | Name: ${user.fullName} | PhoneMasked: ${user.phoneMasked}`);
      
      const isEmail = user.phoneMasked?.includes("@");
      const userEmail = isEmail ? user.phoneMasked : undefined;
      const phoneRegex = /^\+?[1-9]\d{9,14}$/;
      const userPhone = (!isEmail && phoneRegex.test(user.phoneMasked)) ? user.phoneMasked : undefined;

      const callbackUrl = `${process.env.API_URL}/api/payment/report/dummy/callback`;

      try {
        const link = await PaymentService.createPaymentLink({
          amount: 29,
          bookingId: `report_dummy_${user._id}`,
          userName: user.fullName,
          userContact: userPhone,
          userEmail: userEmail,
          callbackUrl,
        });
        console.log(`  -> SUCCESS: ${link.paymentLinkId}`);
      } catch (err: any) {
        console.error(`  -> ERROR for user ${user._id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('ERROR OCCURRED:', err.message, err.stack);
  } finally {
    await mongoose.disconnect();
  }
}

run();
