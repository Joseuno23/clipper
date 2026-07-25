import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD_SALT_ROUNDS = 12;

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function hashPassword(
  password: string,
  saltRounds = DEFAULT_PASSWORD_SALT_ROUNDS,
) {
  return bcrypt.hash(password, saltRounds);
}
