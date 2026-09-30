import { User } from './User';
import { Category } from './Category';
import { Course } from './Course';
import { Lesson } from './Lesson';
import { Enrollment } from './Enrollment';
import { Progress } from './Progress';

let done = false;

/** Centraliza todas las asociaciones en un solo lugar (se llama una vez) */
export const setupAssociations = (): void => {
  if (done) return;
  done = true;

  // Teacher 1:N Courses
  User.hasMany(Course, { foreignKey: 'teacherId', as: 'teachingCourses' });
  Course.belongsTo(User, { foreignKey: 'teacherId', as: 'teacher' });

  // Category 1:N Courses
  Category.hasMany(Course, { foreignKey: 'categoryId', as: 'courses' });
  Course.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

  // Course 1:N Lessons
  Course.hasMany(Lesson, { foreignKey: 'courseId', as: 'lessons' });
  Lesson.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

  // Students N:M Courses (a través de enrollments)
  User.belongsToMany(Course, { through: Enrollment, foreignKey: 'studentId', otherKey: 'courseId', as: 'enrolledCourses' });
  Course.belongsToMany(User, { through: Enrollment, foreignKey: 'courseId', otherKey: 'studentId', as: 'students' });

  // Acceso directo a la tabla intermedia
  Enrollment.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
  Enrollment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
  Course.hasMany(Enrollment, { foreignKey: 'courseId', as: 'enrollments' });
  User.hasMany(Enrollment, { foreignKey: 'studentId', as: 'enrollments' });

  // Progress
  User.hasMany(Progress, { foreignKey: 'studentId', as: 'progress' });
  Progress.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
  Lesson.hasMany(Progress, { foreignKey: 'lessonId', as: 'progress' });
  Progress.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
};
