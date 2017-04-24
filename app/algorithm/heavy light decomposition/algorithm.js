import StructTree from './structTree'
import SegmentTree from '../segment tree/segmentTree'
import LeastCommonAncestor from '../lowest common ancestor/algorithm'

class HeavyLightDecomposition {
  constructor (graph) {
    this.graph = graph
    this.size = graph.size

    this.tree = new StructTree(graph)
  }

  decomposition () {
    this.paths = []
    this.heavyLight()
    this.decompositionPath()
    this.leastCommonAncestor = new LeastCommonAncestor(this.tree)
  }

  heavyLight () {
    for (let i = 0; i < this.size; i += 1) {
      if (this.graph.edgesFrom(i).length) {
        let start = i
        let startSegmentSize = this.segmentSize(start)
        let isExistHeavy = false

        let isRoot = false
        if (i === 0) {
          isRoot = true
        }

        if (!this.tree.isExistNode(start)) {
          this.tree.addNode(start, isRoot)
        }

        this.graph.edgesFrom(start).forEach((edge) => {
          if (!this.tree.isExistNode(edge.vertex)) {
            this.tree.addNode(edge.vertex)
          }

          if (!isExistHeavy && this.segmentSize(edge.vertex) >= startSegmentSize / 2) {
            // edge (v, c) - heavy
            isExistHeavy = true
            this.tree.addEdge(start, edge.vertex, true)
          } else {
            // edge (v, c) - light
            this.tree.addEdge(start, edge.vertex, false)
          }
        })
      }
    }
  }

  decompositionPath () {
    this.tree.nodes.forEach((node) => {
      if (node.heavyEdge === null) {
        let path = [node.vertex]
        let lastNode = node.vertex

        let currentNode = node.parent
        while (currentNode) {
          path.push(currentNode.vertex)

          if (currentNode.heavyEdge !== lastNode) {
            break
          }
          lastNode = currentNode.vertex
          currentNode = currentNode.parent
        }

        let segmentTree = new SegmentTree(this.graph)
        segmentTree.build(path)
        path.segmentTree = segmentTree
        this.paths.push(path)
      }
    })
  }

  segmentSize (start) {
    this.memo = this.memo || {}

    if (this.memo[start]) {
      return this.memo[start]
    } else {
      let children
      if (this.graph.edgesFrom(start).length) {
        children = this.graph.edgesFrom(start).reduce((sum, elem) => {
          return sum + this.segmentSize(elem.vertex)
        }, 1)
      } else {
        children = 1
      }
      this.memo[start] = children
      return children
    }
  }

  maxEdge (start, end) {
    let commonNode = this.leastCommonAncestor.getAncestor(start, end)
    let pathsFromStart = null
    let pathsFromEnd = null

    let max = null
    if (start === commonNode) {
      pathsFromEnd = this.getPaths(end, commonNode)
      max = this.getMaxFromPaths(pathsFromEnd, end, commonNode)
    } else if (end === commonNode) {
      pathsFromStart = this.getPaths(start, commonNode)
      max = this.getMaxFromPaths(pathsFromStart, start, commonNode)
    } else {
      pathsFromStart = this.getPaths(start, commonNode)
      pathsFromEnd = this.getPaths(end, commonNode)

      let maxFromStart = this.getMaxFromPaths(pathsFromStart, start, commonNode)
      let maxFromEnd = this.getMaxFromPaths(pathsFromEnd, end, commonNode)

      max = this.getMaxEdge(maxFromStart, maxFromEnd)
    }
    return max
  }

  getMaxFromPaths (paths, start, end) {
    let maxEdge = { weight: -Infinity }
    let previousPathEnd = null
    for (let i = 0; i < paths.length; i += 1) {
      let pathStart = null
      let pathEnd = null

      if (i === 0) {
        pathStart = paths[i].indexOf(start)
      } else {
        pathStart = paths[i].indexOf(previousPathEnd)
      }

      if (i === paths.length - 1) {
        pathEnd = paths[i].indexOf(end)
      } else {
        pathEnd = paths[i].length - 1
        previousPathEnd = paths[i][paths[i].length - 1]
      }

      // maxEdge = this.getMaxEdge(paths[i].segmentTree.getMax(1, 0, paths[i].length - 2, pathStart, pathEnd), maxEdge)
      maxEdge = this.getMaxEdge(paths[i].segmentTree.getMax(1, paths[i][pathStart], paths[i][pathEnd]), maxEdge)
    }

    return maxEdge
  }

  getMaxEdge () {
    let max = null
    for (let i = 0; i < arguments.length; i += 1) {
      if (max) {
        if (arguments[i].weight > max.weight) {
          max = arguments[i]
        }
      } else {
        max = arguments[i]
      }
    }
    return max
  }

  getPaths (start, end) {
    let pathsFromStart = []
    let path = []
    let pathStart = null

    while (path.indexOf(end) === -1) {
      for (let i = 0; i < this.paths.length; i += 1) {
        if ((pathStart === null && this.paths[i].indexOf(start) !== -1) ||
          (pathStart !== null && this.paths[i].indexOf(pathStart) !== -1 &&
          this.paths[i][this.paths[i].length - 1] !== pathStart)) {
          path = this.paths[i]
          pathsFromStart.push(path)
          pathStart = path[path.length - 1]
          break
        }
      }
    }

    return pathsFromStart
  }
}

export default HeavyLightDecomposition
