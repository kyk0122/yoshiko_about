export const AUTO_ROTATION_SECONDS = 30;
export const AUTO_ROTATION_SPEED = (Math.PI * 2) / AUTO_ROTATION_SECONDS;
export const AUTO_RESUME_DELAY_MS = 3000;
export const DRAG_SENSITIVITY = 0.008;

export class TurntableState {
  constructor({ reducedMotion = false } = {}) {
    this.isDragging = false;
    this.lastInteractionTime = -Infinity;
    this.rotationY = 0;
    this.autoRotateEnabled = !reducedMotion;
    this.lastPointerX = 0;
  }

  beginDrag(pointerX, now) {
    this.isDragging = true;
    this.lastPointerX = pointerX;
    this.lastInteractionTime = now;
  }

  dragTo(pointerX, now) {
    if (!this.isDragging) return false;
    const deltaX = pointerX - this.lastPointerX;
    this.rotationY += deltaX * DRAG_SENSITIVITY;
    this.lastPointerX = pointerX;
    this.lastInteractionTime = now;
    return true;
  }

  endDrag(now) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.lastInteractionTime = now;
  }

  step(deltaSeconds, now) {
    if (
      this.autoRotateEnabled
      && !this.isDragging
      && now - this.lastInteractionTime >= AUTO_RESUME_DELAY_MS
    ) {
      this.rotationY += AUTO_ROTATION_SPEED * deltaSeconds;
    }
    return this.rotationY;
  }
}
