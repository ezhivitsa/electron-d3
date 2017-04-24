import DFS from '../depth-first search/dfs'

class LeastCommonAncestor {
  constructor (segmentTree) {
    this.segmentTree = segmentTree

    DFS.dfs(this.segmentTree)
  }

  upper (a, b) {
    return a.timeIn <= b.timeIn && a.timeOut >= b.timeOut
  }

  getAncestor (start, end) {
    let startNode = this.segmentTree.getNode(start)
    let endNode = this.segmentTree.getNode(end)

    if (this.upper(startNode, endNode)) {
      return start
    } else if (this.upper(endNode, startNode)) {
      return end
    } else {
      // let ancestor = startNode.ancestors[startNode.ancestors.length - 1];
      // for ( let i = startNode.ancestors.length - 1; i >= 0; i -= 1 ) {
      //   if (!this.upper(startNode.ancestors[i], endNode)) {
      //     ancestor = startNode.ancestors[i];
      //   }
      // }
      let ancestor = startNode.parent
      while (ancestor) {
        if (this.upper(ancestor, endNode)) {
          break
        } else {
          ancestor = ancestor.parent
        }
      }
      return ancestor.vertex
    }
  }
}

export default LeastCommonAncestor
