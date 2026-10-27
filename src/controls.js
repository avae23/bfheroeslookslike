// Pointer lock is the normal mode. Some embeds refuse it, so we fall back to
// free mouse look while the cursor is over the page.
export const controls = {
  fallback: false,
  get active() {
    return !!document.pointerLockElement || this.fallback;
  },
};
