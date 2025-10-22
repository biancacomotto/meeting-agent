-- CreateTable
CREATE TABLE "CustomerMemory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" TEXT NOT NULL,
    "stateJson" JSONB NOT NULL DEFAULT {},
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ConversationMemory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "historyJson" JSONB NOT NULL DEFAULT [],
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerMemoryId" INTEGER,
    CONSTRAINT "ConversationMemory_customerMemoryId_fkey" FOREIGN KEY ("customerMemoryId") REFERENCES "CustomerMemory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMemory_customerId_key" ON "CustomerMemory"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMemory_conversationId_key" ON "ConversationMemory"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationMemory_customerId_idx" ON "ConversationMemory"("customerId");
