package com.oney.WebRTCModule;

import org.junit.Test;
import static org.junit.Assert.*;

public class FallHeuristicTest {
  @Test public void needsRecentDownwardTransitionAndEnforcesCooldown() {
    FallHeuristic detector=new FallHeuristic();
    assertFalse(detector.observe(.20f,.03f,.70f,1000));
    assertFalse(detector.observe(.02f,.20f,.35f,2000));
    assertFalse(detector.observe(.20f,.03f,.38f,2300));
    assertTrue(detector.observe(.20f,.03f,.55f,2500));
    assertFalse(detector.observe(.02f,.20f,.35f,3000));
    assertFalse(detector.observe(.20f,.03f,.55f,3200));
  }
  @Test public void rejectsSlowTransition() {
    FallHeuristic detector=new FallHeuristic();
    assertFalse(detector.observe(.02f,.20f,.35f,1000));
    assertFalse(detector.observe(.20f,.03f,.55f,4000));
  }
}
