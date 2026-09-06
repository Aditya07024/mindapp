import { User, TherapistBooking } from "@/models";

export class TherapistService {
  static async getTherapistProfile(therapistId: string): Promise<any> {
    const therapist = await User.findById(therapistId);
    
    if (!therapist || therapist.role !== "therapist" || !therapist.therapistProfile) {
      return null;
    }

    const bookings = await TherapistBooking.countDocuments({
      therapistId,
      status: "completed"
    });

    return {
      id: therapist._id,
      name: therapist.therapistProfile.name,
      rciNumber: therapist.therapistProfile.rciNumber,
      verified: therapist.therapistProfile.verified,
      specializations: therapist.therapistProfile.specializations,
      languages: therapist.therapistProfile.languages,
      rating: therapist.therapistProfile.rating,
      sessionsCompleted: bookings,
      availability: therapist.therapistProfile.availability,
      introVideoUrl: therapist.therapistProfile.introVideoUrl,
      bio: therapist.therapistProfile.bio,
      fee: therapist.therapistProfile.sessionFee
    };
  }

  static async searchTherapists(filters: {
    specialty?: string;
    language?: string;
    priceRange?: { min: number; max: number };
    availability?: string;
  }): Promise<any[]> {
    const query: any = { role: "therapist", "therapistProfile.verified": true };

    if (filters.specialty) {
      query["therapistProfile.specializations"] = new RegExp(filters.specialty, "i");
    }

    if (filters.language) {
      query["therapistProfile.languages"] = filters.language;
    }

    if (filters.priceRange) {
      query["therapistProfile.sessionFee"] = {
        $gte: filters.priceRange.min,
        $lte: filters.priceRange.max
      };
    }

    const therapists = await User.find(query)
      .select("therapistProfile")
      .limit(20);

    return therapists.map(t => ({
      id: t._id,
      name: t.therapistProfile?.name,
      specializations: t.therapistProfile?.specializations,
      languages: t.therapistProfile?.languages,
      rating: t.therapistProfile?.rating,
      sessionFee: t.therapistProfile?.sessionFee,
      verified: t.therapistProfile?.verified
    }));
  }

  static async getAvailability(therapistId: string): Promise<any[]> {
    const therapist = await User.findById(therapistId);
    
    if (!therapist?.therapistProfile) return [];

    const nextSevenDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const dayOfWeek = date.getDay();
      const availableSlots = therapist.therapistProfile.availability
        ?.filter(a => a.day === dayOfWeek)
        .map(a => ({
          date: date.toISOString().split('T')[0],
          slots: a.slots
        })) || [];

      if (availableSlots.length > 0) {
        nextSevenDays.push(...availableSlots);
      }
    }

    // Filter out already booked slots
    const bookedSlots = await TherapistBooking.find({
      therapistId,
      status: { $in: ["confirmed", "completed"] }
    });

    return nextSevenDays.filter(slot => {
      return !bookedSlots.some(booking => {
        const bookingDate = booking.slot.toISOString().split('T')[0];
        return bookingDate === slot.date;
      });
    });
  }

  static async getTherapistDashboard(therapistId: string): Promise<any> {
    const completedBookings = await TherapistBooking.countDocuments({
      therapistId,
      status: "completed"
    });

    const upcomingBookings = await TherapistBooking.find({
      therapistId,
      status: "confirmed",
      slot: { $gte: new Date() }
    }).sort({ slot: 1 }).limit(5);

    const earnings = await TherapistBooking.aggregate([
      {
        $match: {
          therapistId,
          status: "completed"
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$payment.amount" }
        }
      }
    ]);

    return {
      sessionsCompleted: completedBookings,
      upcomingBookings: upcomingBookings.map(b => ({
        clientName: b.userId,
        slot: b.slot,
        status: b.status
      })),
      totalEarnings: earnings[0]?.totalEarnings || 0,
      monthlyEarnings: 0 // Calculate separately
    };
  }
}
