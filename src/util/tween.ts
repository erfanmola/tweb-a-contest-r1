type TweenInstance = {
  startTime: number;
  duration: number;
  progress: number;
  isActive: boolean;
  cancel: () => void;
};

const tweens: Set<TweenInstance> = new Set();
let isUpdating = false;

function updateTweens() {
  if (tweens.size === 0) {
    isUpdating = false;
    return;
  }

  const now = performance.now();

  tweens.forEach((tweenItem) => {
    if (!tweenItem.isActive) {
      tweens.delete(tweenItem);
      return;
    }

    const elapsed = (now - tweenItem.startTime) / 1000;
    tweenItem.progress = Math.min(elapsed / tweenItem.duration, 1);

    if (tweenItem.progress >= 1) {
      tweenItem.isActive = false;
      tweens.delete(tweenItem);
    }
  });

  requestAnimationFrame(updateTweens);
}

export function tween(duration: number): { progress: () => number; cancel: () => void } {
  const instance: TweenInstance = {
    startTime: performance.now(),
    duration,
    progress: 0,
    isActive: true,
    cancel() {
      instance.isActive = false;
      tweens.delete(instance);
    },
  };

  tweens.add(instance);

  if (!isUpdating) {
    isUpdating = true;
    requestAnimationFrame(updateTweens);
  }

  return {
    progress: () => instance.progress,
    cancel: instance.cancel,
  };
}
