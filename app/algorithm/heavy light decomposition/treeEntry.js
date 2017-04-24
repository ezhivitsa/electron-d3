class TreeEntry {
  constructor (vertex) {
    this.parent = null
    this.vertex = vertex
    this.children = []
    this.heavyEdge = null
    this.ancestors = []
    this.color = 0
  }
}

export default TreeEntry
