import mongoose, { Document, Schema } from 'mongoose';

export interface ICourseReview extends Document {
  courseId: number;
  studentId: number;
  studentName: string;
  rating: number;
  comment?: string;
  isVerifiedEnrollment: boolean;
  createdAt: Date;
}

const CourseReviewSchema = new Schema<ICourseReview>(
  {
    courseId: { type: Number, required: true, index: true },
    studentId: { type: Number, required: true },
    studentName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1500 },
    isVerifiedEnrollment: { type: Boolean, default: false }, // true = el usuario realmente estuvo inscripto
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

// Índice compuesto: un estudiante solo puede dejar una reseña por curso
CourseReviewSchema.index({ courseId: 1, studentId: 1 }, { unique: true });

export const CourseReview = mongoose.model<ICourseReview>('CourseReview', CourseReviewSchema);
