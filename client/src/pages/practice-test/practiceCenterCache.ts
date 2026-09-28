class PracticeCenterCache {
  private readonly entries = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.entries.get(key) as T | undefined;
  }

  set<T>(key: string, value: T) {
    this.entries.set(key, value);
  }

  clear() {
    this.entries.clear();
  }
}

export const practiceCenterCache = new PracticeCenterCache();

export const invalidatePracticeCenterCache = () => {
  practiceCenterCache.clear();
};
