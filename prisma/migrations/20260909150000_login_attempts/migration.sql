-- Sign-in attempts, used to slow repeated password guessing across serverless
-- instances. Rows are pruned opportunistically once outside the window.
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_attempts_key_attempted_at_idx" ON "login_attempts"("key", "attempted_at");
