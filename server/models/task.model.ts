import { APP_MODULES, type AppModule } from "./appModule.js";
import { Schema, model, HydratedDocument } from "mongoose";

export interface TaskComment {
  companyId: string;
  _id: string;
  taskId: string;
  author: string;
  comment: string;
  serverVersion: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number;
}

export interface Task {
  companyId: string;
  module: AppModule;
  _id: string;
  taskNumber: string;
  author: string;
  recipients: string[];
  subject: string;
  message: string;
  priority: "HAUTE" | "MOYENNE" | "BASSE";
  deadline: Date;
  isResolved: number;
  resolutionNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  comments: TaskComment[];
  serverVersion: number;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number;
}

export type TaskDocument = HydratedDocument<Task>;
export type TaskCommentDocument = HydratedDocument<TaskComment>;

const taskCommentSchema = new Schema<TaskComment>(
  {
    companyId: {
      type: String,
      required: true,
      trim: true,
    },
    _id: {
      type: String,
      required: true,
    },

    taskId: {
      type: String,
      required: true,
    },

    author: {
      type: String,
      ref: "AdminUsers",
      required: true,
    },

    comment: {
      type: String,
      required: true,
      trim: true,
    },
    serverVersion: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },

    updatedAt: {
      type: Date,
      required: true,
    },

    isDeleted: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  {
    _id: false,
    versionKey: false,
  }
);

const taskSchema = new Schema<Task>(
  {
    companyId: {
      type: String,
      required: true,
      trim: true,
    },
    module: {
      type: String,
      required: true,
      enum: APP_MODULES,
      default: "HR",
    },
    _id: {
      type: String,
      required: true,
    },

    taskNumber: {
      type: String,
      required: true,
    },

    author: {
      type: String,
      ref: "AdminUsers",
      required: true,
    },

    recipients: {
      type: [
        {
          type: String,
          ref: "AdminUsers",
        },
      ],
      required: true,

      validate: {
        validator: (recipients: string[]) => recipients.length > 0,
        message: "At least one recipient is required.",
      },
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
    },

    priority: {
      type: String,
      required: true,
      enum: ["HAUTE", "MOYENNE", "BASSE"],
    },

    deadline: {
      type: Date,
      required: true,
    },

    isResolved: {
      type: Number,
      default: 0,
      required: true,
    },

    resolutionNotes: {
      type: String,
      trim: true,
    },

    resolvedAt: {
      type: Date,
    },

    resolvedBy: {
      type: String,
    },

    comments: {
      type: [taskCommentSchema],
      default: [],
    },

    submittedAt: {
      type: Date,
      required: true,
    },

    serverVersion: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },

    createdAt: {
      type: Date,
      required: true,
    },

    updatedAt: {
      type: Date,
      required: true,
    },

    isDeleted: {
      type: Number,
      required: true,
      default: 0,
      enum: [0, 1],
    },
  },
  {
    versionKey: false,
  }
);

const Task = model<Task>("Tasks", taskSchema);

export default Task;
