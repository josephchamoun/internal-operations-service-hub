-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,

    PRIMARY KEY ("user_id", "team_id"),
    CONSTRAINT "TeamMembership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeamMembership_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "category_id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "default_team_id" TEXT,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "Category_default_team_id_fkey" FOREIGN KEY ("default_team_id") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Priority" (
    "priority_id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "escalation_window_minutes" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "idp_subject_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Request" (
    "request_id" TEXT NOT NULL PRIMARY KEY,
    "requester_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "owning_team_id" TEXT NOT NULL,
    "priority_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "claimed_by" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Request_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "User" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category" ("category_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_owning_team_id_fkey" FOREIGN KEY ("owning_team_id") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "Priority" ("priority_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_claimed_by_fkey" FOREIGN KEY ("claimed_by") REFERENCES "User" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "message_id" TEXT NOT NULL PRIMARY KEY,
    "request_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "Message_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request" ("request_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "attachment_id" TEXT NOT NULL PRIMARY KEY,
    "request_id" TEXT NOT NULL,
    "message_id" TEXT,
    "uploader_id" TEXT NOT NULL,
    "file_ref" BLOB NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "Attachment_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request" ("request_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attachment_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message" ("message_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "User" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequestEvent" (
    "event_id" TEXT NOT NULL PRIMARY KEY,
    "request_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "from_value" TEXT,
    "to_value" TEXT,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "RequestEvent_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request" ("request_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RequestEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Silence" (
    "user_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "silenced_at" DATETIME NOT NULL,

    PRIMARY KEY ("user_id", "request_id"),
    CONSTRAINT "Silence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Silence_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request" ("request_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "access_id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "accessed_at" DATETIME NOT NULL,
    CONSTRAINT "AccessLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccessLog_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request" ("request_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TeamMembership_team_id_idx" ON "TeamMembership"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_idp_subject_id_key" ON "User"("idp_subject_id");

-- CreateIndex
CREATE INDEX "Request_owning_team_id_status_idx" ON "Request"("owning_team_id", "status");

-- CreateIndex
CREATE INDEX "Request_requester_id_status_idx" ON "Request"("requester_id", "status");

-- CreateIndex
CREATE INDEX "Request_status_claimed_by_idx" ON "Request"("status", "claimed_by");

-- CreateIndex
CREATE INDEX "Message_request_id_created_at_idx" ON "Message"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "RequestEvent_request_id_event_type_created_at_idx" ON "RequestEvent"("request_id", "event_type", "created_at");
