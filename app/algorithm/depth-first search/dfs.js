class DFS {
  static dfs (tree) {
    let dfsTimer = { value: 0 }
    let timeIn = []
    let timeOut = []

    DFS.dfsIteration(tree.root, dfsTimer, timeIn, timeOut)
  }

  static dfsIteration (node, dfsTimer, timeIn, timeOut) {
    node.timeIn = dfsTimer.value++
    node.color = 1

    node.children.forEach((childNode) => {
      if (childNode.color === 0) {
        DFS.dfsIteration(childNode, dfsTimer, timeIn, timeOut)
      }
    })

    node.color = 2
    node.timeOut = dfsTimer.value++
  }
}

export default DFS
