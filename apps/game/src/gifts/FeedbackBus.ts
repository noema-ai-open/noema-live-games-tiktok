export type FeedbackTier = "small" | "medium" | "large";

export type GiftFeedback = {
  /** Stable per streak, so a running combo updates in place. */
  key: string;
  tier: FeedbackTier;
  icon: string;
  /** Display name of the sender. */
  sender: string;
  /** Gift label as reported by the connector. */
  giftLabel: string;
  /** Effect the gift triggered, e.g. `+1 REPARATUR`. */
  effectLabel: string;
  repeatCount: number;
  createdAt: number;
  /** True once the streak is finalized and the effect actually fired. */
  applied: boolean;
};

export type FeedbackListener = (feedback: GiftFeedback) => void;

/**
 * Render-only channel. It carries no simulation state, so gift feedback can be
 * shown immediately without touching determinism.
 */
export class FeedbackBus {
  private readonly listeners = new Set<FeedbackListener>();

  subscribe(listener: FeedbackListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(feedback: GiftFeedback): void {
    for (const listener of this.listeners) listener(feedback);
  }

  clear(): void {
    this.listeners.clear();
  }
}
