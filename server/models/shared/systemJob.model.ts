import { Schema, model } from "mongoose";

export interface SystemJobDocument {
  job: string;
  lastRun: Date | null;
  status: "SUCCESS" | "FAILED" | "RUNNING";
  message: string;
  updatedAt: Date;
}

const systemJobSchema = new Schema<SystemJobDocument>({
  job: {
    type: String,
    required: true,
    unique: true,
  },

  lastRun: {
    type: Date,
    default: null,
  },

  status: {
    type: String,
    enum: ["SUCCESS", "FAILED", "RUNNING"],
    default: "RUNNING",
  },

  message: {
    type: String,
    default: "",
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const SystemJob = model<SystemJobDocument>("SystemJobs", systemJobSchema);

export default SystemJob;
