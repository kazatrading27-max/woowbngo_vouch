UPDATE "User" SET role = 'SUPER_ADMIN' WHERE id = (SELECT id FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
