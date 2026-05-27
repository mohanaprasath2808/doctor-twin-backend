-- CreateTable
CREATE TABLE "users" (
    "user_id" VARCHAR(64) NOT NULL,
    "email" VARCHAR(256) NOT NULL,
    "password_hash" VARCHAR(256),
    "role" VARCHAR(64) NOT NULL,
    "location_code" VARCHAR(32),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" VARCHAR(64),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "permissions" JSONB,
    "metadata" JSONB,
    "user_pin_hash" VARCHAR(128),
    "user_pin_set" BOOLEAN NOT NULL DEFAULT false,
    "face_id_set" BOOLEAN NOT NULL DEFAULT false,
    "backup_codes" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "session_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "auth_method" VARCHAR(32) NOT NULL,
    "role" VARCHAR(64) NOT NULL,
    "location_code" VARCHAR(32),
    "device_id" VARCHAR(128),
    "ip_address" VARCHAR(64),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_break_glass" BOOLEAN NOT NULL DEFAULT false,
    "hipaa_gate_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "key_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "key_prefix" VARCHAR(12) NOT NULL,
    "scopes" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("key_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "session_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "replaced_by_hash" VARCHAR(64),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "break_glass_events" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "session_id" VARCHAR(64) NOT NULL,
    "reason" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "break_glass_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_tokens" (
    "id" SERIAL NOT NULL,
    "phone_hash" VARCHAR(64) NOT NULL,
    "otp_hash" VARCHAR(64) NOT NULL,
    "otp_expires_at" TIMESTAMPTZ NOT NULL,
    "patient_token" VARCHAR(128),
    "token_expires_at" TIMESTAMPTZ,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp" (
    "id" SERIAL NOT NULL,
    "recipient" VARCHAR(256) NOT NULL,
    "recipient_type" VARCHAR(16) NOT NULL,
    "otp_hash" VARCHAR(64) NOT NULL,
    "otp_type" VARCHAR(32) NOT NULL DEFAULT 'login',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "appointment_id" VARCHAR(64) NOT NULL,
    "patient_id" VARCHAR(64) NOT NULL,
    "reason" TEXT,
    "insurance_name" VARCHAR(200),
    "provider_name" VARCHAR(200),
    "category" VARCHAR(200),
    "appointment_type" VARCHAR(200),
    "appointment_date" DATE,
    "time_slot" VARCHAR(32),
    "status" VARCHAR(32) NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("appointment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "patient_tokens_patient_token_key" ON "patient_tokens"("patient_token");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
