export const USER_ROLES = ['STUDENT', 'TEACHER', 'ADMIN'] as const;
export const ENROLLMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'REFUNDED'] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface IUser {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  bio?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface ICourse {
  id: number;
  title: string;
  description?: string | null;
  teacherId: number;
  categoryId?: number | null;
  price: number;
  maxStudents: number;
  isPublished: boolean;
  createdAt: Date;
}

export interface ILesson {
  id: number;
  courseId: number;
  title: string;
  content?: string | null;
  orderIndex: number;
  durationMinutes?: number | null;
}

export interface IEnrollment {
  id: number;
  studentId: number;
  courseId: number;
  enrolledAt: Date;
  status: EnrollmentStatus;
  paymentStatus: PaymentStatus;
}

/** Payload guardado dentro del JWT */
export interface AuthUser {
  id: number;
  role: UserRole;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
