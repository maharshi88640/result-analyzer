
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  createdAt: Date;
  comparePassword(pwd: string): Promise<boolean>;
}


<<<<<<< HEAD
=======

>>>>>>> 6974c8e (working)
export interface IFile extends Document {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  data: any[]; // Array of parsed Excel data
  userEmail: string; // Email of the user who uploaded the file
  uploadedAt: Date;
<<<<<<< HEAD
=======
  dataSize: number; // Size of data in bytes
  isChunked: boolean; // Whether data is stored in chunks
>>>>>>> 6974c8e (working)
}

export interface IAnalysisHistory extends Document {
  userId: mongoose.Types.ObjectId;
  fileId: mongoose.Types.ObjectId;
  name: string;
  state: {
    selectedSheet: string;
    query: {
      filters: any[];
      searchTerm: string;
    };
  };
  createdAt: Date;
}



const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// hash password before save
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

// compare password method
UserSchema.methods.comparePassword = async function (pwd: string): Promise<boolean> {
  return bcrypt.compare(pwd, this.password);
};


<<<<<<< HEAD
=======

>>>>>>> 6974c8e (working)
const FileSchema: Schema = new Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },
  data: { type: [Schema.Types.Mixed], required: true },
  userEmail: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
<<<<<<< HEAD
=======
  dataSize: { type: Number, default: 0 },
  isChunked: { type: Boolean, default: false },
>>>>>>> 6974c8e (working)
});

const AnalysisHistorySchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fileId: { type: Schema.Types.ObjectId, ref: 'File', required: true },
  name: { type: String, required: true },
  state: {
    selectedSheet: { type: String, required: true },
    query: {
      filters: { type: [Schema.Types.Mixed], default: [] },
      searchTerm: { type: String, default: '' },
    },
  },
  createdAt: { type: Date, default: Date.now },
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);
export const FileModel = mongoose.model<IFile>('File', FileSchema);
export const AnalysisHistoryModel = mongoose.model<IAnalysisHistory>('AnalysisHistory', AnalysisHistorySchema);
