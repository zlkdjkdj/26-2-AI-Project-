package com.oney.WebRTCModule;

/** A rough posture transition signal, not a validated fall detector. */
public final class FallHeuristic {
  private long uprightAt, cooldownUntil;
  private float uprightCenter;
  public boolean observe(float dx, float dy, float center, long now) {
    if (dy > dx * 1.2f && dy > .1f) {
      uprightAt = now;
      uprightCenter = center;
      return false;
    }
    if (uprightAt > 0 && now - uprightAt < 2200 && center - uprightCenter > .10f
        && dx > dy * 1.15f && now > cooldownUntil) {
      uprightAt = 0;
      cooldownUntil = now + 30000;
      return true;
    }
    return false;
  }
}
