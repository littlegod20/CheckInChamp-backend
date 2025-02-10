import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string, {
      serverSelectionTimeoutMS: 50000, // Increase timeout to 50s
      socketTimeoutMS: 45000, // Increase socket timeout
    }); // No extra options needed
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  }
};
