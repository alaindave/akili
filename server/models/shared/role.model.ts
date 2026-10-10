import mongoose, { Schema } from "mongoose";
import { Permission } from "../../types/Permissions.js";

export interface RoleDocument {
  companyId: string;
  _id: string;
  name: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number;
}

const roleSchema = new Schema<RoleDocument>(
  {
    companyId: {
      type: String,
      required: true,
    },

    _id: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    permissions: {
      type: [String],
      required: true,
      default: [],
    },

    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    isDeleted: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    versionKey: false,
  }
);

roleSchema.index(
  {
    companyId: 1,
    name: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model<RoleDocument>("Roles", roleSchema);
