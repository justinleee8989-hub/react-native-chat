/**
 * The last data a screen loaded, for the signed-in account only, so that the same screen mounted
 * again starts from it and refreshes quietly instead of starting empty.
 *
 * On PC a master list (通讯录, 我的) is mounted again whenever navigation moves between the section
 * root and a detail; starting empty, it showed its loading state and then jumped to the content.
 * Another account never reads it: a different key clears what was kept.
 */
export function rememberedValue<T> () {
  let kept: { account: string, value: T } | undefined
  return {
    get: (account: string) => (kept?.account === account ? kept.value : undefined),
    set: (account: string, value: T) => {
      kept = { account, value }
    },
  }
}
