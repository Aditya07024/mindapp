import '../config/env';
import mongoose from 'mongoose';
import { User } from '../models';
import PaymentService from '../services/payment.service';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  try {
    const user = await User.findOne({ role: 'user' });
    if (!user) {
      console.log('No user found');
      return;
    }
    console.log('Testing with user:', user._id, 'Name:', user.fullName, 'PhoneMasked:', user.phoneMasked);
    const isEmail = user.phoneMasked?.includes("@");
    const userEmail = isEmail ? user.phoneMasked : undefined;
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    const userPhone = (!isEmail && phoneRegex.test(user.phoneMasked)) ? user.phoneMasked : undefined;

    const callbackUrl = `${process.env.API_URL}/api/payment/report/dummy/callback`;

    console.log('Calling PaymentService with:', {
      amount: 29,
      bookingId: 'report_dummy',
      userName: user.fullName,
      userContact: userPhone,
      userEmail: userEmail,
      callbackUrl
    });

    const link = await PaymentService.createPaymentLink({
      amount: 29,
      bookingId: 'report_dummy',
      userName: user.fullName,
      userContact: userPhone,
      userEmail: userEmail,
      callbackUrl,
    });

    console.log('SUCCESS:', link);
  } catch (err: any) {
    console.error('ERROR OCCURRED:', err.message, err.stack);
  } finally {
    await mongoose.disconnect();
  }
}

run();
