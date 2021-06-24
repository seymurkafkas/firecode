import type { firestore } from 'firebase-admin';
import type {
  Traversable,
  TraverseEachConfig,
  TraversalResult,
  BaseTraversalConfig,
  BatchCallback,
  BatchCallbackAsync,
} from './types';

export interface Traverser<T = firestore.DocumentData> {
  readonly traversable: Traversable<T>; // TODO: Probably needs to be generic

  /**
   * Updates the specified keys of the traverser configuration.
   * @param config Partial traversal configuration.
   * @returns A new traverser object.
   */
  withConfig(config: Partial<BaseTraversalConfig>): Traverser<T>;

  /**
   * Registers a callback function that fires right before the current batch starts processing.
   * @param callback A synchronous callback that takes batch doc snapshots and the 0-based batch index as its arguments.
   */
  onBeforeBatchStart(callback: BatchCallback<T>): void;

  /**
   * Registers a callback function that fires after the current batch is processed.
   * @param callback A synchronous callback that takes batch doc snapshots and the 0-based batch index as its arguments.
   */
  onAfterBatchComplete(callback: BatchCallback<T>): void;

  /**
   * Traverses the entire collection in batches of the size specified in traversal config. Invokes the specified
   * async callback for each batch of document snapshots. Waits for the callback Promise to resolve before moving to the next batch.
   * @param callback An asynchronous callback function to invoke for each batch of document snapshots.
   * @returns A Promise resolving to an object representing the details of the traversal.
   */
  traverse(callback: BatchCallbackAsync<T>): Promise<TraversalResult>;

  /**
   * Traverses the entire collection in batches of the size specified in traversal config. Invokes the specified
   * callback sequentially for each document snapshot in each batch.
   * @param callback An asynchronous callback function to invoke for each document snapshot in each batch.
   * @param config The sequential traversal configuration.
   * @returns A Promise resolving to an object representing the details of the traversal.
   */
  traverseEach(
    callback: (snapshot: firestore.QueryDocumentSnapshot<T>) => Promise<void>,
    config?: Partial<TraverseEachConfig>
  ): Promise<TraversalResult>;
}
