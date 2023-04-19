export default class ConcurrentQueue<T> {
  private items: T[] = [];
  private patchEvent: (item: T) => Promise<boolean>;

  constructor(patchEvent: (item: T) => Promise<boolean>) {
    this.patchEvent = patchEvent;
  }

  get length() {
    return this.items.length;
  }

  async enqueue(item: T) {
    this.items.push(item);
  }

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