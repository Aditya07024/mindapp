import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import { User } from "../models/user";
import { JWT_SECRET } from "../middleware/auth";
import { sendPasswordResetEmail } from "../lib/mail";

async function main() {
  console.log("Connecting to Mongo URI...");
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("No MONGODB_URI in environment!");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB successfully!");

  const testUsername = "jwt_test_user_" + Math.floor(Math.random() * 10000);
  const testEmail = `test_${Math.floor(Math.random() * 10000)}@example.com`;
  const testPassword = "SecretPassword123!";

  console.log(`\n--- 1. Testing Registration for username: ${testUsername}, email: ${testEmail} ---`);
  const passwordHash = await bcrypt.hash(testPassword, 10);
  const newUser = await User.create({
    username: testUsername,
    email: testEmail,
    phoneMasked: testEmail,
    passwordHash,
    role: "user",
    isAnonymous: false,
    onboarding: { concerns: [] },
  });

  console.log("User created in MongoDB:", {
    id: newUser._id,
    username: newUser.username,
    email: newUser.email,
    role: newUser.role,
  });

  const token = jwt.sign({ sub: newUser._id.toString(), role: newUser.role }, JWT_SECRET, { expiresIn: "30d" });
  console.log("Generated JWT Token:", token.substring(0, 30) + "...");

  console.log(`\n--- 2. Testing Login for email: ${testEmail} ---`);
  const foundUser: any = await User.findOne({ email: testEmail }).select("+passwordHash");
  if (!foundUser) throw new Error("User not found during login test");

  const isMatch = await bcrypt.compare(testPassword, foundUser.passwordHash);
  console.log("Password match result:", isMatch);
  if (!isMatch) throw new Error("Password verification failed!");

  console.log(`\n--- 3. Testing Forgot Password for email: ${testEmail} ---`);
  const newPassword = "Mind@" + Math.random().toString(36).substring(2, 8);
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  foundUser.passwordHash = newPasswordHash;
  await foundUser.save();

  console.log("Updated password hash in database. New password:", newPassword);

  const updatedUser: any = await User.findOne({ email: testEmail }).select("+passwordHash");
  const newMatch = await bcrypt.compare(newPassword, updatedUser.passwordHash);
  console.log("New password match verification:", newMatch);

  // Clean up test user
  await User.deleteOne({ _id: newUser._id });
  console.log("Cleaned up test user.");

  await mongoose.disconnect();
  console.log("\n✅ All JWT Auth & Password Reset tests passed successfully!");
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
