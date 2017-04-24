import Entry from './treeEntry'

class StructTree {
  constructor (graph) {
    this.graph = graph
    this.nodes = []
    this.root = null
  }

  addNode (vertex, isRoot) {
    let entry = new Entry(vertex)
    this.nodes[vertex] = entry

    if (isRoot) {
      this.root = entry
    }
    return entry
  }

  getNode (vertex) {
    return this.nodes[vertex]
  }

  isExistNode (vertex) {
    return this.nodes[vertex] !== undefined
  }

  addEdge (start, end, isHeavy) {
    if (this.isExistNode(start) && this.isExistNode(end)) {
      let startNode = this.getNode(start)
      let endNode = this.getNode(end)

      startNode.children.push(endNode)
      endNode.parent = startNode

      if (isHeavy) {
        startNode.heavyEdge = end
      }

      // endNode.ancestors.push(endNode.parent);
      // endNode.ancestors = endNode.ancestors.concat(endNode.parent.ancestors);
      // if ( end === 2 ) {
      //     debugger
      // }
      // let currentParent = endNode.parent;
      // while ( currentParent ) {
      //     endNode.ancestors.push(currentParent);
      //     currentParent = currentParent.parent;
      // }
    }
  }
}

export default StructTree
