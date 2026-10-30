/** Binary min-heap of (priority, index) pairs. topF holds the priority of the last popped entry. */
export class Heap {
  private f: number[] = [];
  private i: number[] = [];
  topF = 0;

  get size(): number { return this.f.length; }

  push(f: number, i: number): void {
    const F = this.f, I = this.i;
    let k = F.length;
    F.push(f); I.push(i);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (F[p] <= F[k]) break;
      [F[p], F[k]] = [F[k], F[p]]; [I[p], I[k]] = [I[k], I[p]];
      k = p;
    }
  }

  pop(): number {
    const F = this.f, I = this.i, top = I[0];
    this.topF = F[0];
    const lf = F.pop()!, li = I.pop()!;
    if (F.length) {
      F[0] = lf; I[0] = li;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < F.length && F[l] < F[m]) m = l;
        if (r < F.length && F[r] < F[m]) m = r;
        if (m === k) break;
        [F[m], F[k]] = [F[k], F[m]]; [I[m], I[k]] = [I[k], I[m]];
        k = m;
      }
    }
    return top;
  }
}
