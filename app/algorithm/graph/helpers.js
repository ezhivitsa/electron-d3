import Graph from './graph'
import DirectedGraph from './directedGraph'

class GraphHelpers {
  static copy (graph) {
    let result = new Graph(graph.size)

    for (let i = 0; i < graph.size; i += 1) {
      graph.adjacencyList[i].forEach((edge) => {
        if (!result.isExistEdge(i, edge.vertex)) {
          result.addEdge(i, edge.vertex, edge.weight)
        }
      })
    }

    return result
  }

  static getDirectedGraph (graph, start) {
    start = start || 0

    let result = new DirectedGraph()
    GraphHelpers.addEdges(graph, result, start)

    return result
  }

  static addEdges (graph, result, start) {
    result.addNode(start)
    graph.adjacencyList[start].forEach((edge) => {
      if (!result.isExistEdge(start, edge.vertex) && !result.isExistEdge(edge.vertex, start)) {
        result.addNode(edge.vertex)
        result.addEdge(start, edge.vertex, edge.weight)

        GraphHelpers.addEdges(graph, result, edge.vertex)
      }
    })
  }

  static isEqual (tree1, tree2) {
    for (let i = 0; i < tree1.adjacencyList.length; i += 1) {
      if (tree1.adjacencyList[i] instanceof Array) {
        for (let j = 0; j < tree1.adjacencyList[i].length; j += 1) {
          if (!tree2.isExistEdge(i, tree1.adjacencyList[i][j].vertex)) {
            return false
          }
        }
      }
    }
    return true
  }
}

export default GraphHelpers
