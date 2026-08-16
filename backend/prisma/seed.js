import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Seeds only real operational setup - garment types, delivery zones, and the
// admin login needed to sign in at all. Products, designs, coupons and
// garment photos are deliberately NOT seeded: the catalog is entirely
// admin-managed from here (Admin > Products/Designs/Coupons/Photos), so it
// starts empty rather than shipping with sample/dummy content.
async function main() {
  console.log("Clearing existing catalog data...");
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.design.deleteMany();
  await prisma.garmentPhoto.deleteMany();
  await prisma.productType.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.coupon.deleteMany();

  console.log("Seeding garment types...");
  await prisma.productType.createMany({
    data: [
      { id: "tshirt", name: "T-Shirt", silhouette: "tshirt" },
      { id: "hoodie", name: "Hoodie", silhouette: "hoodie" },
    ],
    skipDuplicates: true,
  });

  console.log("Seeding delivery zones...");
  await prisma.deliveryZone.createMany({
    data: [
      { pincode: "560001", km: 2, fee: 100 },
      { pincode: "560034", km: 4, fee: 100 },
      { pincode: "560095", km: 6, fee: 200 },
      { pincode: "560102", km: 3, fee: 100 },
      { pincode: "560068", km: 9, fee: 200 },
      { pincode: "560038", km: 12, fee: 200 },
      { pincode: "560017", km: 5, fee: 100 },
      { pincode: "560078", km: 1, fee: 100 },
    ],
    skipDuplicates: true,
  });

  console.log("Seeding an admin login...");
  const bcryptModule = await import("bcryptjs");
  const bcrypt = bcryptModule.default || bcryptModule;
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  await prisma.user.upsert({
    where: { email: "admin@athe.example.com" },
    update: {},
    create: { name: "ATHE Admin", email: "admin@athe.example.com", passwordHash, role: "ADMIN" },
  });

  console.log("Done. Products, designs, coupons and photos start empty - add them from the admin app.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
