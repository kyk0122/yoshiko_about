import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  AUTO_RESUME_DELAY_MS,
  AUTO_ROTATION_SECONDS,
  TurntableState,
} from '../turntable-state.js';

test('automatic rotation completes one turn in thirty seconds', () => {
  const state = new TurntableState();
  state.step(AUTO_ROTATION_SECONDS, 0);
  assert.ok(Math.abs(state.rotationY - Math.PI * 2) < 1e-9);
});

test('dragging changes only horizontal rotation and pauses automatic rotation', () => {
  const state = new TurntableState();
  state.beginDrag(100, 1000);
  state.dragTo(150, 1100);
  const draggedAngle = state.rotationY;
  state.step(2, 3100);
  assert.equal(state.rotationY, draggedAngle);
  assert.equal(state.isDragging, true);
});

test('automatic rotation resumes from the released angle after three seconds', () => {
  const state = new TurntableState();
  state.beginDrag(100, 1000);
  state.dragTo(140, 1100);
  state.endDrag(1200);
  const releasedAngle = state.rotationY;
  state.step(1, 1200 + AUTO_RESUME_DELAY_MS - 1);
  assert.equal(state.rotationY, releasedAngle);
  state.step(1, 1200 + AUTO_RESUME_DELAY_MS);
  assert.ok(state.rotationY > releasedAngle);
});

test('reduced motion disables only automatic rotation', () => {
  const state = new TurntableState({ reducedMotion: true });
  state.step(10, 10000);
  assert.equal(state.rotationY, 0);
  state.beginDrag(10, 10001);
  state.dragTo(40, 10002);
  assert.notEqual(state.rotationY, 0);
});

test('page keeps camera controls out and allows vertical touch scrolling', async () => {
  const [html, css, viewer] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
    readFile(new URL('../viewer.js', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net/);
  assert.match(html, /__yoshikoVrmFallbackTimer/);
  assert.match(css, /touch-action:\s*pan-y/);
  assert.doesNotMatch(viewer, /OrbitControls|wheel|pinch|camera\.position\.[xyz]\s*[+\-]=/);
  assert.match(viewer, /turntableRoot\.rotation\.y/);
});
