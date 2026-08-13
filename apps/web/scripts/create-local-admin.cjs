const { createClerkClient } = require("@clerk/backend");
const { execFileSync } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");

function loadEnv(filePath) {
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const env = loadEnv("d:/Getway/apps/api/.env");
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

const email = "admin@getawaynow.dev";
const password = "AdminLocal123!";

async function main() {
  let user;
  const existing = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });

  if (existing.data.length > 0) {
    user = existing.data[0];
    await clerk.users.updateUser(user.id, {
      password,
      firstName: "Admin",
      lastName: "User",
      publicMetadata: { ...(user.publicMetadata || {}), role: "ADMIN" },
    });
    console.log("UPDATED existing Clerk user");
  } else {
    user = await clerk.users.createUser({
      emailAddress: [email],
      password,
      firstName: "Admin",
      lastName: "User",
      publicMetadata: { role: "ADMIN" },
      skipPasswordChecks: true,
    });
    console.log("CREATED Clerk user");
  }

  const id = crypto.randomUUID();
  const sql = `
INSERT INTO users (id, "clerkId", role, email, "firstName", "lastName", "onboardingCompleted", "createdAt", "updatedAt")
VALUES (
  ${sqlLiteral(id)},
  ${sqlLiteral(user.id)},
  'ADMIN',
  ${sqlLiteral(email)},
  'Admin',
  'User',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("clerkId") DO UPDATE SET
  role = 'ADMIN',
  email = EXCLUDED.email,
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "onboardingCompleted" = true,
  "updatedAt" = NOW();
`;

  execFileSync(
    "docker",
    ["exec", "-i", "marketplace_postgres", "psql", "-U", "postgres", "-d", "marketplace", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8" },
  );

  console.log(
    JSON.stringify({ email, password, clerkId: user.id, role: "ADMIN" }),
  );
}

main().catch((e) => {
  console.error("ERR", e?.errors ? JSON.stringify(e.errors, null, 2) : e.message);
  process.exitCode = 1;
});
