-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "idp_subject_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL
);
INSERT INTO "new_User" ("created_at", "email", "idp_subject_id", "name", "role", "user_id") SELECT "created_at", "email", "idp_subject_id", "name", "role", "user_id" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_idp_subject_id_key" ON "User"("idp_subject_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
