import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { User } from "../models";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function updatePragatiVideoOnly() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is not defined in environment.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("Connected successfully.");

  const videoUrl = "https://drive.google.com/file/d/1kGEy71lU13ylK7133mzQnfT97ygIUb56/view?usp=sharing";

  // 1. Find Pragati Chaturvedi therapist document
  const pragatiTherapist = await User.findOne({
    $or: [
      { _id: new mongoose.Types.ObjectId("6a687e616f585f635e1a7909") },
      { fullName: /Pragati Chaturvedi/i },
      { "therapistProfile.name": /Pragati Chaturvedi/i },
      { "therapistProfile.email": "chaturvedpragati1990@gmail.com" },
      { phoneMasked: "chaturvedpragati1990@gmail.com" }
    ]
  });

  if (!pragatiTherapist) {
    console.error("Therapist Dr. Pragati Chaturvedi not found.");
  } else {
    console.log(`Found therapist: ${pragatiTherapist.fullName || pragatiTherapist.therapistProfile?.name} (ID: ${pragatiTherapist._id})`);
    if (!pragatiTherapist.therapistProfile) {
      pragatiTherapist.therapistProfile = {
        name: pragatiTherapist.fullName || "Dr. Pragati Chaturvedi",
        email: "chaturvedpragati1990@gmail.com",
        specializations: ["Clinical Psychology", "Cognitive Behavioral Therapy"],
        languages: ["English", "Hindi"],
        availability: [],
        rating: 4.9,
        sessionCount: 10,
        sessionFee: 1299,
        verified: true,
        verificationStatus: "verified",
        introVideoUrl: videoUrl
      };
    } else {
      pragatiTherapist.therapistProfile.introVideoUrl = videoUrl;
    }
    await pragatiTherapist.save();
    console.log(`Successfully set introVideoUrl for ONLY Dr. Pragati Chaturvedi to: "${videoUrl}"`);

    // 2. Remove introVideoUrl from ALL OTHER therapists
    const unsetResult = await User.updateMany(
      {
        role: "therapist",
        _id: { $ne: pragatiTherapist._id }
      },
      {
        $unset: { "therapistProfile.introVideoUrl": "" }
      }
    );
    console.log(`Removed introVideoUrl from ${unsetResult.modifiedCount} other therapist(s).`);
  }

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB. Done!");
}

updatePragatiVideoOnly().catch((err) => {
  console.error("Error updating therapist video:", err);
  process.exit(1);
});
