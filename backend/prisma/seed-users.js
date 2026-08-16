// Safe to run anytime - only touches the two named accounts below, never
// products/orders/designs/etc. Run with: node prisma/seed-users.js
import { PrismaClient } from "@prisma/client";
import bcryptModule from "bcryptjs";
const bcrypt = bcryptModule.default || bcryptModule;
const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 10);
  const staffHash = await bcrypt.hash(process.env.SEED_STAFF_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: "admin@athe.example.com" },
    update: { passwordHash: adminHash, role: "ADMIN" },
    create: { name: "ATHE Admin", email: "admin@athe.example.com", passwordHash: adminHash, role: "ADMIN" },
  });

  await prisma.user.upsert({
    where: { email: "staff@athe.example.com" },
    update: { passwordHash: staffHash, role: "STAFF" },
    create: { name: "ATHE Staff", email: "staff@athe.example.com", passwordHash: staffHash, role: "STAFF" },
  });

  console.log("Admin and Staff accounts updated.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
