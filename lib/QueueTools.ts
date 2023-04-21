/**
 * ConcurrentQueue is a class that represents a queue of items that can be processed concurrently.
 * @template T The type of items in the queue.
 */
export default class ConcurrentQueue<T> {
  private items: T[] = [];
  private patchEvent: (item: T) => Promise<boolean>;

  /**
   * Creates a new instance of ConcurrentQueue.
   * @param patchEvent A function that takes an item of type T and returns a Promise that resolves to a boolean.
   */
  constructor(patchEvent: (item: T) => Promise<boolean>) {
    this.patchEvent = patchEvent;
  }

  /**
   * Gets the number of items in the queue.
   */
  get length() {
    return this.items.length;
  }

  /**
   * Adds an item to the end of the queue.
   * @param item The item to add to the queue.
   */
  async enqueue(item: T) {
    this.items.push(item);
  }

  /**
   * Processes all items in the queue concurrently.
   * @returns A Promise that resolves to a boolean indicating whether all items were processed successfully.
   */
  async refresh(): Promise<boolean> {
    let isAllSuccess = false;
    const N = this.items.length;
    for (let i = 0; i < N; i++) {
      const queueItem = this.items.shift();
      await this.patchEvent(queueItem!)
        .then(succ => {
          if (!succ) {
            isAllSuccess = false;
          }
        })
        .catch((err) => {
          isAllSuccess = true;
          this.items.push(queueItem!);
        });
    }
    return isAllSuccess;
  }
}
