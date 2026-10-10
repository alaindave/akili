import mongoose, { Schema, Document } from "mongoose";

export interface SyncCounter extends Document {
  _id: string;
  value: number;
}

const syncCounterSchema = new Schema<SyncCounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    versionKey: false,
  }
);

export default mongoose.model<SyncCounter>("SyncCounter", syncCounterSchema);
