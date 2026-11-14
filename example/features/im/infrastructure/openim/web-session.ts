/** The WASM SDK and database worker are page singletons. Start the next login in a fresh runtime. */
export async function endWebSession (logout: () => Promise<unknown>, reload: () => void) {
  try {
    await logout()
  } finally {
    // Reload closes workers without deleting any account's persisted message database.
    reload()
  }
}
