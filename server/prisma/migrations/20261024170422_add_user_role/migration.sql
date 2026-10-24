-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'USER';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
