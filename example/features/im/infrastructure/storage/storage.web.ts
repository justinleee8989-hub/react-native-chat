// Each browser tab can sign into a different test account; refresh keeps that tab's session.
export const storage = {
  async getItem(key: string) {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key)
  },
  async setItem(key: string, value: string) {
    sessionStorage.setItem(key, value)
  },
  async removeItem(key: string) {
    sessionStorage.removeItem(key)
  },
}
