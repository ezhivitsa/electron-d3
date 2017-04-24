class SegmentTree {
  constructor (graph) {
    this.graph = graph
  }

  build (vertexesPath) {
    this.t = []
    let weight = []

    if (vertexesPath.length >= 2) {
      for (let i = 0; i < vertexesPath.length - 1; i += 1) {
        weight.push(this.graph.edgeCost(vertexesPath[i + 1], vertexesPath[i]))
      }
    } else {
      weight.push(0)
    }

    this.vertexesPath = vertexesPath
    this.weights = weight

    this.buildSegments(vertexesPath, weight, 1, 0, weight.length - 1)
  }

  buildSegments (vertexesPath, a, v, tl, tr) {
    if (tl === tr) {
      let start = Math.min(vertexesPath[tl], vertexesPath[tl + 1])
      let end = Math.max(vertexesPath[tl], vertexesPath[tl + 1])
      this.t[v] = { weight: a[tl], start: start, end: end }
    } else {
      let tm = Math.floor((tl + tr) / 2)
      this.buildSegments(vertexesPath, a, v * 2, tl, tm)
      this.buildSegments(vertexesPath, a, v * 2 + 1, tm + 1, tr)
      this.t[v] = this.sum(this.t[v * 2], this.t[v * 2 + 1])
    }
  }

  sum (a, b) {
    let result = { weight: a.weight + b.weight }
    result.start = Math.min(a.start, a.end, b.start, b.end)
    result.end = Math.max(a.start, a.end, b.start, b.end)
    return result
  }

  update (v, tl, tr, pos, newVal) {
    if (tl === tr) {
      this.t[v] = newVal
    } else {
      let tm = Math.floor((tl + tr) / 2)
      if (pos <= tm) {
        this.update(v * 2, tl, tm, pos, newVal)
      } else {
        this.update(v * 2 + 1, tm + 1, tr, pos, newVal)
      }
      this.t[v] = this.t[v * 2] + this.t[v * 2 + 1]
    }
  }

  // getMax(v, tl, tr, l, r) {
  //   if (l > r) {
  //     return { weight: -Infinity, start: 0, end: 0 }
  //   }
  //   if (l == tl && r == tr) {
  //     return this.t[v]
  //   }
  //   let tm = Math.floor((tl + tr) / 2)
  //   return this.combine (
  //     this.getMax(v*2, tl, tm, l, Math.min(r, tm)),
  //     this.getMax(v*2 + 1, tm + 1, tr, Math.max(l, tm + 1), r)
  //   )
  // }

  getMax (v, start, end) {
    let secondVertex = null
    let maxEdge = { weight: -Infinity }

    for (let i = 0; i < this.vertexesPath.length; i += 1) {
      if (secondVertex !== null) {
        if (this.vertexesPath[i] === secondVertex) {
          break
        } else if (maxEdge.weight < this.weights[i]) {
          maxEdge = {
            weight: this.weights[i],
            start: this.vertexesPath[i],
            end: this.vertexesPath[i + 1]
          }
        }
      } else {
        if (this.vertexesPath[i] === start) {
          secondVertex = end
          i -= 1
        } else if (this.vertexesPath[i] === end) {
          secondVertex = start
          i -= 1
        }
      }
    }

    return maxEdge
  }

  combine (a, b) {
    if (a.weight >= b.weight) {
      return a
    } else {
      return b
    }
  }
}

export default SegmentTree
