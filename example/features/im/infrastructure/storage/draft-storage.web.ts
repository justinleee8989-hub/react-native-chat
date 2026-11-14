export const draftStorage = {
  async getItem (key: string) {
    return localStorage.getItem(key)
  },
  async setItem (key: string, value: string) {
    localStorage.setItem(key, value)
  },
}
