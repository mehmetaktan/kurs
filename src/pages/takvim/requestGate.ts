/** Geç tamamlanan bir aralık isteğinin yeni görünümü ezmesini engeller. */
export class RequestGate {
  private current = 0

  next(): number {
    this.current += 1
    return this.current
  }

  isCurrent(request: number): boolean {
    return request === this.current
  }

  invalidate(): void {
    this.current += 1
  }
}
